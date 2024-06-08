import DataProcessor from '../../../processor';
import { ContractDBTransaction } from '../../../database';
import {EosioContractRow} from '../../../../types/eosio';
import { ShipBlock } from '../../../../types/ship';
import {eosioTimestampToDate} from '../../../../utils/eosio';
import {
    LaunchesUpdatePriority,
} from '../index';
import {ImageTableRow} from '../types/tables';
import LaunchesHandler from '../index';

const imagesTableListener = (core: LaunchesHandler, contract: string) => async (db: ContractDBTransaction, block: ShipBlock, delta: EosioContractRow<ImageTableRow>): Promise<void> => {
    if (!delta.present) {
        await db.delete('launchbagz_tokens', {
            str: 'contract = $1 AND token_contract = $2 AND token_code = $3',
            values: [contract, delta.scope, delta.value.code],
        });
    } else {
        const result = await db.query('SELECT * FROM launchbagz_tokens WHERE contract = $1 AND token_contract = $2 AND token_code = $3', [contract, delta.scope, delta.value.code]);
        if (result.rows.length === 0) {
            await db.insert('launchbagz_tokens', {
                contract,
                token_contract: delta.scope,
                token_code: delta.value.code,
                image: delta.value.img,
                updated_at_block: block.block_num,
                updated_at_time: eosioTimestampToDate(block.timestamp).getTime(),
                created_at_block: block.block_num,
                created_at_time: eosioTimestampToDate(block.timestamp).getTime(),
            }, ['contract', 'token_contract', 'token_code']);
        } else {
            await db.update('launchbagz_tokens', {
                image: delta.value.img,
                updated_at_block: block.block_num,
                updated_at_time: eosioTimestampToDate(block.timestamp).getTime(),
            }, {
                str: 'contract = $1 AND token_contract = $2 AND token_code = $3',
                values: [contract, delta.scope, delta.value.code]
            }, ['contract', 'token_contract', 'token_code']);
        }
    }
};

export function imagesProcessor(core: LaunchesHandler, processor: DataProcessor): () => any {
    const destructors: Array<() => any> = [];
    const contract = core.args.registry_account;

    destructors.push(processor.onContractRow(
        contract, 'images',
        imagesTableListener(core, contract),
        LaunchesUpdatePriority.TABLE_IMAGES.valueOf()
    ));

    return (): any => destructors.map(fn => fn());
}
