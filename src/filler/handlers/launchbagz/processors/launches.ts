import DataProcessor from '../../../processor';
import { ContractDBTransaction } from '../../../database';
import {EosioActionTrace, EosioContractRow, EosioTransaction} from '../../../../types/eosio';
import { ShipBlock } from '../../../../types/ship';
import {eosioTimestampToDate, stringToDisplayData} from '../../../../utils/eosio';
import UpgradesListHandler, {
    LaunchesUpdatePriority,
} from '../index';
import {
    encodeDatabaseJson,
} from '../../../utils';
import {
    LogNewLaunchAction,
} from '../types/actions';
import {LaunchTableRow} from '../types/tables';
import LaunchesHandler from '../index';

export async function initLaunches(): Promise<void> {

}

const newLaunchListener = (core: LaunchesHandler, contract: string) => async (db: ContractDBTransaction, block: ShipBlock, tx: EosioTransaction, trace: EosioActionTrace<LogNewLaunchAction>): Promise<void> => {
    const [amountString, tokenCode] = trace.act.data.amount.quantity.split(' ');
    const tokenPrecision = +(amountString.split('.')[1]?.length || '0');
    const displayData = stringToDisplayData(trace.act.data.display_data, {});
    await db.insert('launchbagz_launches', {
        contract,
        launch_id: trace.act.data.launch_id,
        token_contract: trace.act.data.amount.contract,
        token_code: tokenCode,
        token_precision: tokenPrecision,
        launch_time: trace.act.data.launch_date * 1000,
        display_data: encodeDatabaseJson(displayData),
        is_hidden: trace.act.data.is_hidden,
        updated_at_block: block.block_num,
        updated_at_time: eosioTimestampToDate(block.timestamp).getTime(),
        created_at_block: block.block_num,
        created_at_time: eosioTimestampToDate(block.timestamp).getTime(),
    }, ['contract', 'launch_id']);
};

const launchesTableListener = (core: LaunchesHandler, contract: string) => async (db: ContractDBTransaction, block: ShipBlock, delta: EosioContractRow<LaunchTableRow>): Promise<void> => {
    if (!delta.present) {
        await db.delete('launchbagz_launches', {
            str: 'contract = $1 AND launch_id = $2',
            values: [contract, delta.value.launch_id],
        });
    } else {
        const displayData = stringToDisplayData(delta.value.display_data, {});
        await db.update('launchbagz_launches', {
            launch_time: delta.value.launch_date * 1000,
            display_data: encodeDatabaseJson(displayData),
            is_hidden: delta.value.is_hidden,
            blend_contract: core.args.launch_account,
            blend_id: delta.value.blend_id,
            updated_at_block: block.block_num,
            updated_at_time: eosioTimestampToDate(block.timestamp).getTime(),
        }, {
            str: 'contract = $1 AND launch_id = $2',
            values: [contract, delta.value.launch_id]
        }, ['contract', 'launch_id']);
    }
};

export function launchesProcessor(core: UpgradesListHandler, processor: DataProcessor): () => any {
    const destructors: Array<() => any> = [];
    const contract = core.args.registry_account;
    const launchContract = core.args.launch_account;

    destructors.push(processor.onActionTrace(
        contract, 'lognewlaunch',
        newLaunchListener(core, contract),
        LaunchesUpdatePriority.LOG_NEW_LAUNCH.valueOf()
    ));

    destructors.push(processor.onContractRow(
        launchContract, 'launches',
        launchesTableListener(core, contract),
        LaunchesUpdatePriority.TABLE_LAUNCHES.valueOf()
    ));

    return (): any => destructors.map(fn => fn());
}
