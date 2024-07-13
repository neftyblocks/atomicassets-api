import DataProcessor from '../../../processor';
import { ContractDBTransaction } from '../../../database';
import {EosioContractRow} from '../../../../types/eosio';
import { ShipBlock } from '../../../../types/ship';
import {eosioTimestampToDate} from '../../../../utils/eosio';
import {
    LaunchesArgs,
    LaunchesUpdatePriority,
} from '../index';
import {
    bulkInsert,
    getAllRowsFromTable,
} from '../../../utils';
import {VestingTableRow} from '../types/tables';
import LaunchesHandler from '../index';
import ConnectionManager from '../../../../connections/manager';

const fillVestings = async (args: LaunchesArgs, connection: ConnectionManager): Promise<void> => {
    const vestingsCount = await connection.database.query(
        'SELECT COUNT(*) FROM launchbagz_vestings WHERE contract = $1',
        [args.vestings_account]
    );

    if (Number(vestingsCount.rows[0].count) === 0) {
        const vestingsTable = await getAllRowsFromTable(connection.chain.rpc, {
            json: true, code: args.vestings_account,
            scope: args.vestings_account, table: 'vestings'
        }, 1000) as VestingTableRow[];

        const dbRows = vestingsTable.map(row => getVestingDbRow(row, args, null, null));

        if (dbRows.length > 0) {
            await bulkInsert(connection.database, 'launchbagz_vestings', dbRows);
        }
    }
};

export async function initVestings(args: LaunchesArgs, connection: ConnectionManager): Promise<void> {
    if (args.vestings_account) {
        await fillVestings(args, connection);
    }
}

const vestingsTableListener = (core: LaunchesHandler) => async (db: ContractDBTransaction, block: ShipBlock, delta: EosioContractRow<VestingTableRow>): Promise<void> => {
    const is_active = delta.present;
    const row = getVestingDbRow(delta.value, core.args, block.block_num, block.timestamp);
    if (!is_active && row.total_claimed !== row.total_allocation) {
        row.total_claimed = row.total_allocation;
        row.last_claim_time = row.updated_at_time;
    }
    await db.replace('launchbagz_vestings', {
        ...row,
        is_active,
    }, ['contract', 'vesting_id'], ['created_at_block', 'created_at_time']);
};

function getVestingDbRow(vesting: VestingTableRow, args: LaunchesArgs, blockNumber: number, blockTimeStamp: string): any {
    const [precision, tokenCode] = vesting.token.sym.split(',');
    const tokenContract = vesting.token.contract;
    return {
        contract: args.vestings_account,
        vesting_id: vesting.vesting_id,
        recipient: vesting.recipient,
        owner: vesting.owner,
        token_contract: tokenContract,
        token_code: tokenCode,
        token_precision: +precision,
        start_time: vesting.start_time * 1000,
        last_claim_time: vesting.last_claim_time * 1000,
        total_claimed: vesting.total_claimed,
        immediate_unlock: vesting.immediate_unlock,
        total_allocation: vesting.total_allocation,
        period_length: vesting.period_length * 1000,
        total_periods: vesting.total_periods,
        description: vesting.description,
        is_active: true,
        updated_at_block: blockNumber || 0,
        updated_at_time: blockTimeStamp ? eosioTimestampToDate(blockTimeStamp).getTime() : 0,
        created_at_block: blockNumber || 0,
        created_at_time: blockTimeStamp ? eosioTimestampToDate(blockTimeStamp).getTime() : 0
    };
}

export function vestingsProcessor(core: LaunchesHandler, processor: DataProcessor): () => any {
    const destructors: Array<() => any> = [];
    const contract = core.args.vestings_account;

    if (contract) {
        destructors.push(processor.onContractRow(
            contract, 'vestings',
            vestingsTableListener(core),
            LaunchesUpdatePriority.TABLE_VESTINGS.valueOf()
        ));
    }

    return (): any => destructors.map(fn => fn());
}
