import { ContractDBTransaction } from '../../../database';
import { EosioContractRow } from '../../../../types/eosio';
import { ShipBlock } from '../../../../types/ship';
import { eosioTimestampToDate } from '../../../../utils/eosio';
import ConnectionManager from '../../../../connections/manager';
import { PacksTableRow } from '../types/tables';
import {
    bulkInsert,
    getAllRowsFromTable
} from '../../../utils';
import PacksHandler, {PacksArgs, PacksUpdatePriority} from '../index';
import DataProcessor from '../../../processor';

const fillPacks = async (args: PacksArgs, connection: ConnectionManager, contract: string): Promise<void> => {
    const packsCount = await connection.database.query(
        'SELECT COUNT(*) FROM neftypacks_packs WHERE assets_contract = $1 AND contract = $2',
        [args.atomicassets_account, contract]
    );

    if (Number(packsCount.rows[0].count) === 0) {
        const packsTable = await getAllRowsFromTable(connection.chain.rpc, {
            json: true, code: contract,
            scope: contract, table: 'packs'
        }, 1000) as PacksTableRow[];

        const dbMaps = packsTable.map(pack => getPackDbRows(pack, args, null, null, contract));

        const packDbRows = [];
        for (const {
            packDbRow,
        } of dbMaps) {
            packDbRows.push(packDbRow);
        }

        await bulkInsert(connection.database, 'neftypacks_packs', packDbRows);
    }
};

export async function initPacks(args: PacksArgs, connection: ConnectionManager): Promise<void> {
    await fillPacks(args, connection, args.nefty_packs_account);
    await fillPacks(args, connection, args.atomic_packs_account);
}

const packsTableListener = (core: PacksHandler, contract: string) => async (db: ContractDBTransaction, block: ShipBlock, delta: EosioContractRow<PacksTableRow>): Promise<void> => {
    const pack = await db.query(
        'SELECT pack_id FROM neftypacks_packs WHERE assets_contract = $1 AND contract = $2 AND pack_id = $3',
        [core.args.atomicassets_account, contract, delta.value.pack_id]
    );

    if (!delta.present) {
        const deleteString = 'assets_contract = $1 AND contract = $2 AND pack_id = $3';
        const deleteValues = [core.args.atomicassets_account, contract, delta.value.pack_id];
        await db.delete('neftypacks_packs', {
            str: deleteString,
            values: deleteValues,
        });
    } else if (pack.rowCount === 0) {
        const {
            packDbRow,
        } = getPackDbRows(
            delta.value, core.args, block.block_num, block.timestamp, contract
        );
        await db.insert('neftypacks_packs', packDbRow, ['contract', 'pack_id']);
    } else {
        await db.update('neftypacks_packs', {
            unlock_time: delta.value.unlock_time * 1000,
            use_count: delta.value.use_count || 0,
            display_data: delta.value.display_data,
            updated_at_block: block.block_num,
            updated_at_time: eosioTimestampToDate(block.timestamp).getTime(),
        }, {
            str: 'contract = $1 AND pack_id = $2',
            values: [contract, delta.value.pack_id]
        }, ['contract', 'pack_id']);
    }
};

export function packsProcessor(core: PacksHandler, processor: DataProcessor): () => any {
    const destructors: Array<() => any> = [];
    const neftyContract = core.args.nefty_packs_account;
    const atomicContract = core.args.atomic_packs_account;

    destructors.push(processor.onContractRow(
        neftyContract, 'packs',
        packsTableListener(core, neftyContract),
        PacksUpdatePriority.TABLE_PACKS.valueOf()
    ));

    destructors.push(processor.onContractRow(
        atomicContract, 'packs',
        packsTableListener(core, atomicContract),
        PacksUpdatePriority.TABLE_PACKS.valueOf()
    ));

    return (): any => destructors.map(fn => fn());
}

function getPackDbRows(pack: PacksTableRow, args: PacksArgs, blockNumber: number, blockTimeStamp: string, contract: string): any {
    return {
        packDbRow: {
            assets_contract: args.atomicassets_account,
            contract,
            collection_name: pack.collection_name,
            pack_id: pack.pack_id,
            pack_template_id: pack.pack_template_id,
            unlock_time: pack.unlock_time * 1000,
            use_count: pack.use_count || 0,
            display_data: pack.display_data,
            updated_at_block: blockNumber || 0,
            updated_at_time: blockTimeStamp ? eosioTimestampToDate(blockTimeStamp).getTime() : 0,
            created_at_block: blockNumber || 0,
            created_at_time: blockTimeStamp ? eosioTimestampToDate(blockTimeStamp).getTime() : 0,
        },
    };
}
