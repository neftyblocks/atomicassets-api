import DataProcessor from '../../../processor';
import { ContractDBTransaction } from '../../../database';
import {EosioActionTrace, EosioContractRow, EosioTransaction} from '../../../../types/eosio';
import { ShipBlock } from '../../../../types/ship';
import {eosioTimestampToDate, stringToDisplayData} from '../../../../utils/eosio';
import {
    LaunchesUpdatePriority,
} from '../index';
import {
    encodeDatabaseArray,
    encodeDatabaseJson,
} from '../../../utils';
import {
    LogNewLaunchAction,
} from '../types/actions';
import {LaunchTableRow} from '../types/tables';
import LaunchesHandler from '../index';

const newLaunchListener = (core: LaunchesHandler, contract: string) => async (db: ContractDBTransaction, block: ShipBlock, tx: EosioTransaction, trace: EosioActionTrace<LogNewLaunchAction>): Promise<void> => {
    let tokenCode;
    let tokenPrecision;
    let tokenContract;
    if (trace.act.data.amount) {
        const [amountString, code] = trace.act.data.amount.quantity.split(' ');
        tokenPrecision = +(amountString.split('.')[1]?.length || '0');
        tokenContract = trace.act.data.amount.contract;
        tokenCode = code;
    } else {
        const [precision, code] = trace.act.data.token.sym.split(',');
        tokenPrecision = +precision;
        tokenContract = trace.act.data.token.contract;
        tokenCode = code;
    }

    const displayData = stringToDisplayData(trace.act.data.display_data, {});
    await db.insert('launchbagz_launches', {
        contract,
        launch_id: trace.act.data.launch_id,
        is_hidden: trace.act.data.is_hidden,
        token_contract: tokenContract,
        token_code: tokenCode,
        token_precision: tokenPrecision,
        display_data: encodeDatabaseJson(displayData),
        updated_at_block: block.block_num,
        updated_at_time: eosioTimestampToDate(block.timestamp).getTime(),
        created_at_block: block.block_num,
        created_at_time: eosioTimestampToDate(block.timestamp).getTime(),
        authorized_accounts: encodeDatabaseArray([trace.act.data.issuer, tokenContract]),
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
            display_data: encodeDatabaseJson(displayData),
            is_hidden: delta.value.is_hidden,
            blend_contract: delta.value.blend_contract,
            blend_id: delta.value.blend_id,
            updated_at_block: block.block_num,
            updated_at_time: eosioTimestampToDate(block.timestamp).getTime(),
        }, {
            str: 'contract = $1 AND launch_id = $2',
            values: [contract, delta.value.launch_id]
        }, ['contract', 'launch_id']);
    }
};

export function launchesProcessor(core: LaunchesHandler, processor: DataProcessor): () => any {
    const destructors: Array<() => any> = [];
    const contract = core.args.launch_account;

    destructors.push(processor.onActionTrace(
        contract, 'lognewlaunch',
        newLaunchListener(core, contract),
        LaunchesUpdatePriority.LOG_NEW_LAUNCH.valueOf()
    ));

    destructors.push(processor.onContractRow(
        contract, 'launches',
        launchesTableListener(core, contract),
        LaunchesUpdatePriority.TABLE_LAUNCHES.valueOf()
    ));

    return (): any => destructors.map(fn => fn());
}
