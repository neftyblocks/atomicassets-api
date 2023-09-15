import DataProcessor from '../../../processor';
import { ContractDBTransaction } from '../../../database';
import { EosioContractRow } from '../../../../types/eosio';
import { ShipBlock } from '../../../../types/ship';
import { eosioTimestampToDate } from '../../../../utils/eosio';
import CollectionsListHandler, { AvatarsArgs, AvatarUpdatePriority } from '../index';
import ConnectionManager from '../../../../connections/manager';
import { BlendTableRow } from '../types/tables';
import {
    bulkInsert,
    encodeDatabaseJson,
    getAllRowsFromTable
} from '../../../utils';

const fillBlends = async (args: AvatarsArgs, connection: ConnectionManager, contract: string): Promise<void> => {
    const blendsCount = await connection.database.query(
        'SELECT COUNT(*) FROM neftyavatars_blends',
    );

    if (Number(blendsCount.rows[0].count) === 0) {
        const blendsTable = await getAllRowsFromTable(connection.chain.rpc, {
            json: true, code: contract,
            scope: contract, table: 'blends'
        }, 1000) as BlendTableRow[];

        const blendRows = blendsTable.map(blend => getBlendDbRow(blend, args, null, null));
        if (blendRows.length > 0) {
            await bulkInsert(connection.database, 'neftyavatars_blends', blendRows);
        }
    }
};

export async function initBlends(args: AvatarsArgs, connection: ConnectionManager): Promise<void> {
    await fillBlends(args, connection, args.avatar_account);
}

const blendsTableListener = (core: CollectionsListHandler) => async (db: ContractDBTransaction, block: ShipBlock, delta: EosioContractRow<BlendTableRow>): Promise<void> => {
    const blend = await db.query(
        'SELECT blend_id FROM neftyavatars_blends WHERE blend_id = $1',
        [delta.value.blend_id]
    );

    if (!delta.present) {
        await db.delete('neftyavatars_blends', {
            str: 'blend_id = $1',
            values: [delta.value.blend_id],
        });
    } else if (blend.rowCount === 0) {
        const blendDbRow = getBlendDbRow(
            delta.value, core.args, block.block_num, block.timestamp
        );
        await db.insert('neftyavatars_blends', blendDbRow, ['blend_id']);
    } else {
        const blendDbRow = getBlendDbRow(
            delta.value, core.args, block.block_num, block.timestamp
        );
        delete blendDbRow.blend_id;
        await db.update('neftyavatars_blends', {
            ...blendDbRow,
            updated_at_block: block.block_num,
            updated_at_time: eosioTimestampToDate(block.timestamp).getTime(),
        }, {
            str: 'blend_id = $1',
            values: [delta.value.blend_id]
        }, ['blend_id']);
    }
};

export function blendsProcessor(core: CollectionsListHandler, processor: DataProcessor): () => any {
    const destructors: Array<() => any> = [];
    const contract = core.args.avatar_account;

    destructors.push(processor.onContractRow(
        contract, 'blends',
        blendsTableListener(core),
        AvatarUpdatePriority.TABLE_BLENDS.valueOf()
    ));

    return (): any => destructors.map(fn => fn());
}

function getBlendDbRow(blend: BlendTableRow, args: AvatarsArgs, blockNumber: number, blockTimeStamp: string): any {
    return {
        collection_name: blend.collection_name,
        blend_id: blend.blend_id,
        start_time: blend.start_time * 1000,
        end_time: blend.end_time * 1000,
        max: blend.max,
        lock_count: blend.lock_count,
        use_count: blend.use_count,
        display_data: blend.display_data,
        base_template_id: blend.base_spec.template_id,
        lock_schema_name: blend.lock_spec.locked_char_schema,
        accessory_specs: encodeDatabaseJson(blend.accessory_specs),
        base_spec: encodeDatabaseJson(blend.base_spec),
        updated_at_block: blockNumber || 0,
        updated_at_time: blockTimeStamp ? eosioTimestampToDate(blockTimeStamp).getTime() : 0,
        created_at_block: blockNumber || 0,
        created_at_time: blockTimeStamp ? eosioTimestampToDate(blockTimeStamp).getTime() : 0,
    };
}

