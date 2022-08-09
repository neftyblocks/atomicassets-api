import { QueryResult } from 'pg';
import NeftyDropsHandler, {NeftyDropsUpdatePriority} from '..';
import ConnectionManager from '../../../../connections/manager';
import DataProcessor from '../../../processor';
import {
    bulkInsert,
    getAllScopesFromTable,
    getAllRowsFromTable,
} from '../../../utils';
import {
  parseEosioToDBRow,
} from '../../../../api/namespaces/security/utils';
import {
  AccountStats,
  AccountStatsRow,
  AccountsWhitelist,
  AccountsWhitelistRow,
  AuthKeys,
  AuthKeysRow,
  DropsTableRow,
} from '../types/tables';
import {
  ProofOfOwnership,
  ProofOfOwnershipRow,
} from '../../security/types/tables';
import logger from '../../../../utils/winston';
import {ContractDBTransaction} from '../../../database';
import {ShipBlock} from '../../../../types/ship';
import {EosioContractRow} from '../../../../types/eosio';
import {eosioNameToUint64} from '../../../../utils/eosio';
import {PublicKey} from 'eosjs/dist/PublicKey';

export type NeftyDropsArgs = {
  neftydrops_account: string,
};

const fillAccountStats = async (args: NeftyDropsArgs, connection: ConnectionManager, contract: string): Promise<void> => {
  const table = 'accstats';
  const accountStatsCount = await connection.database.query(
    'SELECT COUNT(*) FROM neftydrops_account_stats'
  ) as QueryResult;
  if (Number(accountStatsCount.rows[0].count) > 0) {
    return; // skip already filled table
  }
  const claimerAccounts = await getAllScopesFromTable(connection.chain.rpc, {
    code: contract, table
  }, 1000);
  if (Number(claimerAccounts.length) === 0) {
    return; // skip empty results
  }

  const allAccountStats: AccountStatsRow[] = [];
  for (let index = 0; index < claimerAccounts.length; index++) {
    const account = claimerAccounts[index].scope;

    logger.info(`Getting accounts stats for scope ${index} / ${claimerAccounts.length}`);
    const dropsAccountStatsTable = await getAllRowsFromTable(connection.chain.rpc, {
      json: true, code: contract,
      scope: account, table
    }, 1000) as AccountStats[];
    dropsAccountStatsTable.forEach(({drop_id, counter, last_claim_time, used_nonces}) => {
      allAccountStats.push({
        claimer: account,
        drop_id,
        use_counter: counter,
        last_claim_time,
        used_nonces,
      });
    });
  }
  if (allAccountStats.length > 0) {
    logger.info(`Inserting ${allAccountStats.length} records to neftydrops_account_stats`);
    await bulkInsert(connection.database, 'neftydrops_account_stats', allAccountStats);
  }
};

const fillAccountWhitelist = async (args: NeftyDropsArgs, connection: ConnectionManager, 
    contract: string, securedDrops: DropsTableRow[]): Promise<void> => {
  const accountWhitelistCount = await connection.database.query(
    'SELECT COUNT(*) FROM neftydrops_accounts_whitelist'
  );
  if (Number(accountWhitelistCount.rows[0].count) > 0) {
    return; // skip already filled table
  }

  const allDropsAccountWhitelist:AccountsWhitelistRow[] = [];

  for (let index = 0; index < securedDrops.length; index++) {
    const drop_id = securedDrops[index].drop_id;

    logger.info(`Getting whitelists for scope ${index} / ${securedDrops.length}`);
    const dropsAccountWhitelistTable = await getAllRowsFromTable(connection.chain.rpc, {
      json: true, code: contract, scope: drop_id, table: 'whitelists',
    }, 1000) as AccountsWhitelist[];
    
    dropsAccountWhitelistTable.forEach(({account, account_limit = 0}) => 
      allDropsAccountWhitelist.push({
        drop_id, account, account_limit,
      })
    );
  }
  logger.info(`Inserting ${allDropsAccountWhitelist.length} records to neftydrops_accounts_whitelist`);
  await bulkInsert(connection.database, 'neftydrops_accounts_whitelist', allDropsAccountWhitelist);
};

const fillAuthKeys = async (args: NeftyDropsArgs, connection: ConnectionManager,
    contract: string, securedDrops: DropsTableRow[]): Promise<void> => {
  const accountAuthKeysCount = await connection.database.query(
    'SELECT COUNT(*) FROM neftydrops_authkeys'
  );
  if (Number(accountAuthKeysCount.rows[0].count) > 0) {
    return; // skip already filled table
  }

  const allDropsAuthKeys:AuthKeysRow[] = [];

  for (let index = 0; index < securedDrops.length; index++) {
    const drop_id = securedDrops[index].drop_id;

    logger.info(`Getting keys for scope ${index} / ${securedDrops.length}`);
    const dropsAuthKeysTable = await getAllRowsFromTable(connection.chain.rpc, {
      json: true, code: contract, scope: drop_id, table: 'authkeys',
    }, 1000) as AuthKeys[];
    
    dropsAuthKeysTable.forEach(
      ({key: public_key, key_limit, key_limit_cooldown, counter: use_counter, last_claim_time}) =>
        allDropsAuthKeys.push({
          drop_id,
          public_key: PublicKey.fromString(public_key).toLegacyString(),
          key_limit,
          key_limit_cooldown,
          use_counter,
          last_claim_time,
        })
    );
  }

  logger.info(`Inserting ${allDropsAuthKeys.length} records to neftydrops_authkeys`);
  await bulkInsert(connection.database, 'neftydrops_authkeys', allDropsAuthKeys);
};

const fillProofOfOwnership = async (args: NeftyDropsArgs,
    connection: ConnectionManager, contract: string): Promise<void> => {
  const accountProofOfOwnershipCount = await connection.database.query(
    'SELECT COUNT(*) FROM neftydrops_proof_of_ownership'
  );
  if (Number(accountProofOfOwnershipCount.rows[0].count) > 0) {
    return; // skip already filled table
  }

  const allDropsProofOfOwnership:ProofOfOwnershipRow[] = [];

  const dropsProofOfOwnershipTable = await getAllRowsFromTable(connection.chain.rpc, {
    json: true, code: contract, scope: contract, table: 'proofown',
  }, 1000) as ProofOfOwnership[];
  
  dropsProofOfOwnershipTable.forEach((proofOfOwnership) => 
    allDropsProofOfOwnership.push(parseEosioToDBRow(proofOfOwnership))
  );
  logger.info(`Inserting ${allDropsProofOfOwnership.length} records to neftydrops_proof_of_ownership`);
  await bulkInsert(connection.database, 'neftydrops_proof_of_ownership', allDropsProofOfOwnership);
};

export async function initSecurityMechanisms(args: NeftyDropsArgs, connection: ConnectionManager): Promise<void> {
  const accountStats = await connection.database.query(
      'SELECT COUNT(*) FROM neftydrops_account_stats'
  );

  if (Number(accountStats.rows[0].count) > 0) {
    return; // Tables already filled
  }

  const allDrops = await getAllRowsFromTable(connection.chain.rpc, {
    json: true, code: args.neftydrops_account, table: 'drops', scope: args.neftydrops_account,
  }, 1000) as DropsTableRow[];
  const securedDrops = allDrops.filter(drop => drop.auth_required);

  if (Number(securedDrops.length) === 0) {
    return; // skip empty results
  }
  await fillAccountStats(args, connection, args.neftydrops_account);
  await fillAccountWhitelist(args, connection, args.neftydrops_account, securedDrops);
  await fillAuthKeys(args, connection, args.neftydrops_account, securedDrops);
  await fillProofOfOwnership(args, connection, args.neftydrops_account);
}

export function securityProcessor(core: NeftyDropsHandler, processor: DataProcessor): () => any {
  const destructors: Array<() => any> = [];
  const contract = core.args.neftydrops_account;

  destructors.push(processor.onContractRow(
      contract, 'accstats',
      async (db: ContractDBTransaction, block: ShipBlock, delta: EosioContractRow<AccountStats>): Promise<void> => {
        await db.delete('neftydrops_account_stats', {
          str: 'claimer = $1 AND drop_id = $2',
          values: [delta.scope, delta.value.drop_id]
        });

        if (delta.present) {
          await db.insert('neftydrops_account_stats', {
              claimer: delta.scope,
              drop_id: delta.value.drop_id,
              use_counter: delta.value.counter,
              last_claim_time: delta.value.last_claim_time,
              used_nonces: delta.value.used_nonces,
          }, ['claimer', 'drop_id']);
        }
      }, NeftyDropsUpdatePriority.TABLE_ACCOUNT_STATS.valueOf()
  ));

  destructors.push(processor.onContractRow(
      contract, 'whitelists',
      async (db: ContractDBTransaction, block: ShipBlock, delta: EosioContractRow<AccountsWhitelist>): Promise<void> => {
        const dropId = eosioNameToUint64(delta.scope);
        await db.delete('neftydrops_accounts_whitelist', {
          str: 'account = $1 AND drop_id = $2',
          values: [delta.value.account, dropId]
        });

        if (delta.present) {
          await db.insert('neftydrops_accounts_whitelist', {
            drop_id: dropId,
            account: delta.value.account,
            account_limit: delta.value.account_limit,
          }, ['drop_id', 'account']);
        }
      }, NeftyDropsUpdatePriority.TABLE_WHITELISTS.valueOf()
  ));

  destructors.push(processor.onContractRow(
      contract, 'authkeys',
      async (db: ContractDBTransaction, block: ShipBlock, delta: EosioContractRow<AuthKeys>): Promise<void> => {
        const dropId = eosioNameToUint64(delta.scope);
        const key = PublicKey.fromString(delta.value.key).toLegacyString();
        await db.delete('neftydrops_authkeys', {
          str: 'public_key = $1 AND drop_id = $2',
          values: [key, dropId]
        });

        if (delta.present) {
          await db.insert('neftydrops_authkeys', {
            drop_id: dropId,
            public_key: key,
            key_limit: delta.value.key_limit,
            key_limit_cooldown: delta.value.key_limit_cooldown,
            use_counter: delta.value.counter,
            last_claim_time: delta.value.last_claim_time,
          }, ['drop_id', 'public_key']);
        }
      }, NeftyDropsUpdatePriority.TABLE_AUTH_KEYS.valueOf()
  ));

  destructors.push(processor.onContractRow(
      contract, 'proofown',
      async (db: ContractDBTransaction, block: ShipBlock, delta: EosioContractRow<ProofOfOwnership>): Promise<void> => {
        await db.delete('neftydrops_proof_of_ownership', {
          str: 'drop_id = $1',
          values: [delta.value.drop_id]
        });

        if (delta.present) {
          await db.insert('neftydrops_proof_of_ownership', parseEosioToDBRow(delta.value), ['drop_id']);
        }
      }, NeftyDropsUpdatePriority.TABLE_PROOF_OWNERSHIP.valueOf()
  ));

  return (): any => destructors.map(fn => fn());
}