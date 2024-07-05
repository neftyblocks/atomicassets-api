import DataProcessor from '../../../processor';
import { ContractDBTransaction } from '../../../database';
import { EosioActionTrace, EosioContractRow, EosioTransaction } from '../../../../types/eosio';
import { ShipBlock } from '../../../../types/ship';
import { eosioTimestampToDate } from '../../../../utils/eosio';
import {
    LaunchesArgs,
    LaunchesUpdatePriority,
} from '../index';
import {
    CreatePartnerFarmAction,
} from '../types/actions';
import {
    TokenFarmPartner,
    TokenFarmPartnerFarm,
    TokenFarmRewardTableRow,
    TokenFarmTableRow,
} from '../types/tables';
import LaunchesHandler from '../index';
import {preventInt64Overflow} from '../../../../utils/binary';
import ConnectionManager from '../../../../connections/manager';
import {bulkInsert, getAllRowsFromTable} from '../../../utils';

const fillFarms = async (args: LaunchesArgs, connection: ConnectionManager): Promise<void> => {
    const [farmsCount, partnersCount] = await Promise.all([
        connection.database.query(
        'SELECT COUNT(*) FROM launchbagz_farms WHERE contract = $1',
        [args.farms_account]
        ),
        connection.database.query(
        'SELECT COUNT(*) FROM launchbagz_farms_partners WHERE contract = $1',
        [args.farms_account]
        )
    ]);

    if (Number(farmsCount.rows[0].count) === 0 && Number(partnersCount.rows[0].count) === 0) {
        const partners = await getAllRowsFromTable<TokenFarmPartner>(connection.chain.rpc, {
            json: true, code: args.farms_account,
            scope: args.vestings_account, table: 'partners'
        }, 1000);

        const partnerDbRows = [];
        const farmCreators: Record<string, string> = {};
        for (const partner of partners) {
            partnerDbRows.push({
                contract: args.farms_account,
                partner: partner.wallet,
            });

            const partnerFarms = await getAllRowsFromTable<TokenFarmPartnerFarm>(connection.chain.rpc, {
                json: true, code: partner.wallet,
                scope: partner.wallet, table: 'farms'
            }, 1000);

            for (const farm of partnerFarms) {
                farmCreators[farm.farm_name] = farm.creator;
            }
        }

        if (partnerDbRows.length > 0) {
            await bulkInsert(connection.database, 'launchbagz_farms_partners', partnerDbRows);
        }

        const farmsTable = await getAllRowsFromTable<TokenFarmTableRow>(connection.chain.rpc, {
            json: true, code: args.farms_account,
            scope: args.farms_account, table: 'farms'
        }, 1000);

        const farmDbRows = [];
        const rewardsDBRows = [];
        for (const farm of farmsTable) {
            farmDbRows.push(getFarmDBRow(args.farms_account, farm, farmCreators, 0));
            const rewards = await getAllRowsFromTable<TokenFarmRewardTableRow>(connection.chain.rpc, {
                json: true, code: args.farms_account,
                scope: farm.farm_name, table: 'rewards'
            }, 1000);
            for (const reward of rewards) {
                rewardsDBRows.push(getRewardDBRow(args.farms_account, farm.farm_name, reward));
            }
        }

        if (farmDbRows.length > 0) {
            await bulkInsert(connection.database, 'launchbagz_farms', farmDbRows);
        }
        if (rewardsDBRows.length > 0) {
            await bulkInsert(connection.database, 'launchbagz_farm_rewards', rewardsDBRows);
        }
    }
};

function getFarmDBRow(contract: string, farm: TokenFarmTableRow, farmCreators: Record<string, string>, blockNumber: number): any {
    return {
        contract,
        farm_name: farm.farm_name,
        creator: farm.creator,
        original_creator: farmCreators[farm.farm_name] || farm.creator,
        staking_token_contract: farm.staking_token.contract,
        staking_token_code: farm.staking_token.sym.split(',')[1],
        staking_token_precision: farm.staking_token.sym.split(',')[0],
        incentive_count: farm.incentive_count,
        total_staked: farm.total_staked,
        vesting_time: farm.vesting_time * 1000,
        updated_at_block: blockNumber,
        updated_at_time: farm.last_update_time * 1000,
        created_at_block: blockNumber,
        created_at_time: farm.time_created * 1000
    };
}

function getRewardDBRow(contract: string, farmName: string, reward: TokenFarmRewardTableRow): any {
    const [poolAmount, poolCode] = reward.reward_pool.quantity.split(' ');
    const precision = poolAmount.split('.')[1]?.length || 0;
    return {
        contract,
        farm_name: farmName,
        id: reward.id,
        period_start: reward.period_start * 1000,
        period_finish: reward.period_finish * 1000,
        reward_rate: reward.reward_rate,
        rewards_duration: reward.rewards_duration * 1000,
        reward_per_token_stored: reward.reward_per_token_stored,
        reward_token_contract: reward.reward_pool.contract,
        reward_token_code: poolCode,
        reward_token_precision: precision,
        reward_pool: preventInt64Overflow(poolAmount.replace('.', '')),
        total_rewards_paid_out: preventInt64Overflow(reward.total_rewards_paid_out.split(' ')[0].replace('.', '')),
    };
}

export async function initFarms(args: LaunchesArgs, connection: ConnectionManager): Promise<void> {
    if (args.farms_account) {
        await fillFarms(args, connection);
    }
}
const newPartnerFarmListener = (core: LaunchesHandler, contract: string) => async (db: ContractDBTransaction, block: ShipBlock, tx: EosioTransaction, trace: EosioActionTrace<CreatePartnerFarmAction>): Promise<void> => {
    const partnerRows = await db.query('SELECT COUNT(*) FROM launchbagz_farms_partners WHERE contract = $1 AND partner = $2', [contract, trace.act.name]);
    if (Number(partnerRows.rows[0].count) === 0) {
        return;
    }

    await db.insert('launchbagz_farms', {
        contract,
        farm_name: trace.act.data.farm_name,
        original_creator: trace.act.data.creator,
        staking_token_contract: trace.act.data.staking_token.contract,
        staking_token_code: trace.act.data.staking_token.sym.split(',')[1],
        staking_token_precision: trace.act.data.staking_token.sym.split(',')[0],
        vesting_time: trace.act.data.vesting_time * 1000,
        updated_at_block: block.block_num,
        updated_at_time: eosioTimestampToDate(block.timestamp).getTime(),
        created_at_block: block.block_num,
        created_at_time: eosioTimestampToDate(block.timestamp).getTime(),
    }, ['contract', 'farm_name']);
};

const farmsTableListener = (core: LaunchesHandler, contract: string) => async (db: ContractDBTransaction, block: ShipBlock, delta: EosioContractRow<TokenFarmTableRow>): Promise<void> => {
    if (!delta.present) {
        await db.delete('launchbagz_farms', {
            str: 'contract = $1 AND farm_name = $2',
            values: [contract, delta.value.farm_name],
        });
    } else {
        await db.replace('launchbagz_farms', getFarmDBRow(contract, delta.value, {}, block.block_num), ['contract', 'farm_name'], ['created_at_block', 'created_at_time', 'original_creator']);
    }
};

const rewardsTableListener = (core: LaunchesHandler, contract: string) => async (db: ContractDBTransaction, block: ShipBlock, delta: EosioContractRow<TokenFarmRewardTableRow>): Promise<void> => {
    if (!delta.present) {
        await db.delete('launchbagz_farm_rewards', {
            str: 'contract = $1 AND farm_name = $2 AND id = $3',
            values: [contract, delta.scope, delta.value.id],
        });
    } else {
        await db.replace('launchbagz_farm_rewards', getRewardDBRow(contract, delta.scope, delta.value), ['contract', 'farm_name', 'id']);
    }
};

const partnersTableListener = (core: LaunchesHandler, contract: string) => async (db: ContractDBTransaction, block: ShipBlock, delta: EosioContractRow<TokenFarmPartner>): Promise<void> => {
    if (!delta.present) {
        await db.delete('launchbagz_farms_partners', {
            str: 'contract = $1 AND partner = $2',
            values: [contract, delta.value.wallet],
        });
    } else {
        await db.replace('launchbagz_farms_partners', {
            contract,
            partner: delta.value.wallet,
        }, ['contract', 'partner']);
    }
};

export function farmsProcessor(core: LaunchesHandler, processor: DataProcessor): () => any {
    const destructors: Array<() => any> = [];
    const contract = core.args.farms_account;

    destructors.push(processor.onActionTrace(
        '*', 'createfarm',
        newPartnerFarmListener(core, contract),
        LaunchesUpdatePriority.ACTION_NEW_PARTNER_FARM.valueOf()
    ));

    destructors.push(processor.onContractRow(
        contract, 'farms',
        farmsTableListener(core, contract),
        LaunchesUpdatePriority.TABLE_LAUNCHES.valueOf()
    ));

    destructors.push(processor.onContractRow(
        contract, 'rewards',
        rewardsTableListener(core, contract),
        LaunchesUpdatePriority.TABLE_TOKEN_FARM_REWARDS.valueOf()
    ));

    destructors.push(processor.onContractRow(
        contract, 'partners',
        partnersTableListener(core, contract),
        LaunchesUpdatePriority.TABLE_TOKEN_FARM_PARTNERS.valueOf()
    ));

    return (): any => destructors.map(fn => fn());
}
