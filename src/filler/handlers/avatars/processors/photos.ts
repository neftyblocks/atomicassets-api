import DataProcessor from '../../../processor';
import { ContractDBTransaction } from '../../../database';
import { EosioContractRow } from '../../../../types/eosio';
import { ShipBlock } from '../../../../types/ship';
import CollectionsListHandler, { AvatarsArgs, AvatarUpdatePriority } from '../index';
import ConnectionManager from '../../../../connections/manager';
import { PhotoTableRow } from '../types/tables';
import {
    bulkInsert,
    getAllRowsFromTable
} from '../../../utils';

const fillPhotos = async (args: AvatarsArgs, connection: ConnectionManager): Promise<void> => {
    const photosCount = await connection.database.query(
        'SELECT COUNT(*) FROM profile_photos',
    );

    if (Number(photosCount.rows[0].count) === 0) {
        const rows = await getAllRowsFromTable(connection.chain.rpc, {
            code: args.photos_account,
            table: 'photos',
            scope: args.photos_account
        }, 1000);
        const dbRows = rows.map((row) => ({
            owner: row.account,
            photo_hash: row.photo_hash,
        }));

        if (dbRows.length > 0) {
            await bulkInsert(connection.database, 'profile_photos', dbRows);
        }
    }
};

export async function initPhotos(args: AvatarsArgs, connection: ConnectionManager): Promise<void> {
    await fillPhotos(args, connection);
}

const photosTableListener = () => async (db: ContractDBTransaction, block: ShipBlock, delta: EosioContractRow<PhotoTableRow>): Promise<void> => {
    const photo = await db.query(
        'SELECT * FROM profile_photos WHERE owner = $1',
        [delta.value.account]
    );

    if (!delta.present) {
        await db.delete('profile_photos', {
            str: 'owner = $1',
            values: [delta.value.account],
        });
    } else if (photo.rowCount === 0) {
        await db.insert('profile_photos', {
            owner: delta.value.account,
            photo_hash: delta.value.photo_hash,
        }, ['owner']);
    } else {
        await db.update('profile_photos', {
            photo_hash: delta.value.photo_hash,
        }, {
            str: 'owner = $1',
            values: [delta.value.account],
        }, ['owner']);
    }
};

export function photosProcessor(core: CollectionsListHandler, processor: DataProcessor): () => any {
    const destructors: Array<() => any> = [];
    const contract = core.args.photos_account;

    destructors.push(processor.onContractRow(
        contract, 'photos',
        photosTableListener(),
        AvatarUpdatePriority.TABLE_PHOTOS.valueOf()
    ));

    return (): any => destructors.map(fn => fn());
}
