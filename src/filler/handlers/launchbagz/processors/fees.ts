import DataProcessor from '../../../processor';
import { ContractDBTransaction } from '../../../database';
import { EosioContractRow } from '../../../../types/eosio';
import { ShipBlock } from '../../../../types/ship';
import {eosioTimestampToDate} from '../../../../utils/eosio';
import {
    LaunchesUpdatePriority,
} from '../index';
import {ChadConfigTableRow, KeksConfigTableRow, TokenConfigTableRow} from '../types/tables';
import LaunchesHandler from '../index';
import logger from '../../../../utils/winston';

const storeFee = async (registryContract: string, tokenContract: string, tokenCode: string, fee: number, db: ContractDBTransaction, block: ShipBlock): Promise<void> => {
    await db.replace('launchbagz_tokens', {
        contract: registryContract,
        token_contract: tokenContract,
        token_code: tokenCode,
        tx_fee: fee,
        image: '',
        created_at_block: block.block_num,
        created_at_time: eosioTimestampToDate(block.timestamp).getTime(),
        updated_at_block: block.block_num,
        updated_at_time: eosioTimestampToDate(block.timestamp).getTime(),
    }, ['contract', 'token_contract', 'token_code'], ['created_at_block', 'created_at_time', 'image']);
};
const launchBagzConfigTableListener = (core: LaunchesHandler, contract: string) => async (db: ContractDBTransaction, block: ShipBlock, delta: EosioContractRow<TokenConfigTableRow>): Promise<void> => {
    try {
        if (delta.value.code && delta.value.tx_fees) {
            let txFee = 0.0;
            if (delta.present) {
                txFee = (delta.value.tx_fees || []).reduce((a: number, b: { bps: number }) => a + b.bps || 0, 0) / 10000.0;
            }
            await storeFee(contract, delta.code, delta.value.code, txFee, db, block);
        }
    } catch (e) {
        logger.error(e);
    }
};

const chadConfigTableListener = (core: LaunchesHandler, contract: string) => async (db: ContractDBTransaction, block: ShipBlock, delta: EosioContractRow<ChadConfigTableRow>): Promise<void> => {
    try {
        if (delta.value.sym) {
            let txFee = 0.0;
            if (delta.present) {
                txFee = (delta.value.fee_receivers || []).reduce((a: number, b: { fee: number }) => a + b.fee || 0, 0);
            }
            const [,tokenCode] = delta.value.sym.split(',');
            await storeFee(contract, delta.code, tokenCode, txFee, db, block);
        }
    } catch (e) {
        logger.error(e);
    }
};

const kekConfigTableListener = (core: LaunchesHandler, contract: string) => async (db: ContractDBTransaction, block: ShipBlock, delta: EosioContractRow<KeksConfigTableRow>): Promise<void> => {
    try {
        let txFee = 0.0;
        if (delta.present) {
            txFee = (delta.value.transaction_fee_percent || 0) / 100.0 + (delta.value.dev_fee_percent || 0) / 100.0;
        }
        await storeFee(contract, delta.code, 'KEK', txFee, db, block);
    } catch (e) {
        logger.error(e);
    }
};

export function feesProcessor(core: LaunchesHandler, processor: DataProcessor): () => any {
    const destructors: Array<() => any> = [];
    const contract = core.args.registry_account;

    destructors.push(processor.onContractRow(
        'chadtoken.gm', 'txfees',
        chadConfigTableListener(core, contract),
        LaunchesUpdatePriority.TABLE_CONFIGS.valueOf()
    ));

    destructors.push(processor.onContractRow(
        'waxpepetoken', 'txfeecfg',
        kekConfigTableListener(core, contract),
        LaunchesUpdatePriority.TABLE_CONFIGS.valueOf()
    ));

    destructors.push(processor.onContractRow(
        '*', 'configs',
        launchBagzConfigTableListener(core, contract),
        LaunchesUpdatePriority.TABLE_CONFIGS.valueOf()
    ));

    return (): any => destructors.map(fn => fn());
}
