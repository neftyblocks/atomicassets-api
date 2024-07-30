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

const imagesTableListener = () => async (db: ContractDBTransaction, block: ShipBlock, delta: EosioContractRow<ImageTableRow>): Promise<void> => {
    if (!delta.present) {
        await db.delete('launchbagz_tokens', {
            str: 'token_contract = $1 AND token_code = $2',
            values: [delta.scope, delta.value.code],
        });
    } else {
        const result = await db.query('SELECT * FROM launchbagz_tokens WHERE token_contract = $1 AND token_code = $2', [delta.scope, delta.value.code]);
        if (result.rows.length === 0) {
            await db.insert('launchbagz_tokens', {
                contract: delta.scope,
                token_contract: delta.scope,
                token_code: delta.value.code,
                image: delta.value.img,
                updated_at_block: block.block_num,
                updated_at_time: eosioTimestampToDate(block.timestamp).getTime(),
                created_at_block: block.block_num,
                created_at_time: eosioTimestampToDate(block.timestamp).getTime(),
            }, ['token_contract', 'token_code']);
        } else {
            await db.update('launchbagz_tokens', {
                image: delta.value.img,
                updated_at_block: block.block_num,
                updated_at_time: eosioTimestampToDate(block.timestamp).getTime(),
            }, {
                str: 'token_contract = $1 AND token_code = $2',
                values: [delta.scope, delta.value.code]
            }, ['token_contract', 'token_code']);
        }
    }
};

export function imagesProcessor(core: LaunchesHandler, processor: DataProcessor): () => any {
    const destructors: Array<() => any> = [];
    const contract = core.args.registry_account;

    destructors.push(processor.onContractRow(
        contract, 'images',
        imagesTableListener(),
        LaunchesUpdatePriority.TABLE_IMAGES.valueOf()
    ));

    return (): any => destructors.map(fn => fn());
}
