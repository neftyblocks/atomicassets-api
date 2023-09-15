import DataProcessor from '../../../processor';
import { ContractDBTransaction } from '../../../database';
import { EosioContractRow } from '../../../../types/eosio';
import { ShipBlock } from '../../../../types/ship';
import CollectionsListHandler, { AvatarsArgs, AvatarUpdatePriority } from '../index';
import ConnectionManager from '../../../../connections/manager';
import { PreferencesTableRow } from '../types/tables';
import {
    bulkInsert,
    getAllRowsFromTable, getAllScopesFromTable
} from '../../../utils';

const fillPfps = async (args: AvatarsArgs, connection: ConnectionManager): Promise<void> => {
    const pfpsCount = await connection.database.query(
        'SELECT COUNT(*) FROM neftyavatars_pfps',
    );

    if (Number(pfpsCount.rows[0].count) === 0) {
        const scopes = await getAllScopesFromTable(connection.chain.rpc, {
            code: args.pfp_account,
            table: 'preferences',
        }, 1000);

        const pfpRows: any[] = [];
        for (let i = 0; i < scopes.length; i++) {
            const scopeRow = scopes[i];
            const rows = await getAllRowsFromTable(connection.chain.rpc, {
                code: scopeRow.code,
                table: scopeRow.table,
                scope: scopeRow.scope,
            }, 1000);
            const dbRows = rows.filter(row => row.key === 'pfp.asset').map((row) => ({
                owner: scopeRow.scope,
                asset_id: row.value,
            }));
            pfpRows.push(...dbRows);
        }
        if (pfpRows.length > 0) {
            await bulkInsert(connection.database, 'neftyavatars_pfps', pfpRows);
        }
    }
};

export async function initPfps(args: AvatarsArgs, connection: ConnectionManager): Promise<void> {
    await fillPfps(args, connection);
}

const preferencesTableListener = () => async (db: ContractDBTransaction, block: ShipBlock, delta: EosioContractRow<PreferencesTableRow>): Promise<void> => {

    // Ignore if not a pfp.asset preference
    if (delta.value.key !== 'pfp.asset') {
        return;
    }

    const pfp = await db.query(
        'SELECT * FROM neftyavatars_pfps WHERE owner = $1',
        [delta.scope]
    );

    if (!delta.present) {
        await db.delete('neftyavatars_pfps', {
            str: 'owner = $1',
            values: [delta.scope],
        });
    } else if (pfp.rowCount === 0) {
        await db.insert('neftyavatars_pfps', {
            owner: delta.scope,
            asset_id: delta.value.value,
        }, ['owner']);
    } else {
        await db.update('neftyavatars_pfps', {
            asset_id: delta.value.value,
        }, {
            str: 'owner = $1',
            values: [delta.scope]
        }, ['owner']);
    }
};

export function pfpsProcessor(core: CollectionsListHandler, processor: DataProcessor): () => any {
    const destructors: Array<() => any> = [];
    const contract = core.args.pfp_account;

    destructors.push(processor.onContractRow(
        contract, 'preferences',
        preferencesTableListener(),
        AvatarUpdatePriority.TABLE_PFP.valueOf()
    ));

    return (): any => destructors.map(fn => fn());
}
