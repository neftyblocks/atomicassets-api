import { QueryResult } from "pg";
import NeftyDropsHandler from "..";
import ConnectionManager from "../../../../connections/manager";
import DataProcessor from "../../../processor";
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
} from "../types/tables";
import {
  ProofOfOwnership,
  ProofOfOwnershipRow,
} from "../../security/types/tables";

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

  const allAccountStats:AccountStatsRow[] = [];

  for (let index = 0; index < claimerAccounts.length; index++) {
    const account = claimerAccounts[index].scope;
    
    const dropsAccountStatsTable = await getAllRowsFromTable(connection.chain.rpc, {
      json: true, code: contract,
      scope: account, table
    }, 1000) as AccountStats[];
    dropsAccountStatsTable.forEach(({drop_id, counter, last_claim_time, used_nonces}) => 
      allAccountStats.push({
        claimer: account,
        drop_id,
        use_counter: counter,
        last_claim_time,
        used_nonces,
      })
    );
  }
  await bulkInsert(connection.database, 'neftydrops_account_stats', allAccountStats);
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
   
    const dropsAccountWhitelistTable = await getAllRowsFromTable(connection.chain.rpc, {
      json: true, code: contract, scope: drop_id, table: 'whitelists',
    }, 1000) as AccountsWhitelist[];
    
    dropsAccountWhitelistTable.forEach(({account, account_limit = 0}) => 
      allDropsAccountWhitelist.push({
        drop_id, account, account_limit,
      })
    );
  }
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
   
    const dropsAuthKeysTable = await getAllRowsFromTable(connection.chain.rpc, {
      json: true, code: contract, scope: drop_id, table: 'authkeys',
    }, 1000) as AuthKeys[];
    
    dropsAuthKeysTable.forEach(
      ({key: public_key, key_limit, key_limit_cooldown, counter: use_counter, last_claim_time}) =>
        allDropsAuthKeys.push({
          drop_id, public_key, key_limit, key_limit_cooldown, use_counter, last_claim_time,
        })
    );
  }

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
  await bulkInsert(connection.database, 'neftydrops_proof_of_ownership', allDropsProofOfOwnership);
};

export async function initSecurityMechanisms(args: NeftyDropsArgs, connection: ConnectionManager): Promise<void> {
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

  return (): any => destructors.map(fn => fn());
}