import {JsonRpc} from 'eosjs/dist';
import PostgresConnection from '../connections/postgres';
import {QueryResult} from 'pg';
import {arrayChunk} from '../utils';
import {GetTableByScopeResultRow} from 'eosjs/dist/eosjs-rpc-interfaces';

export function encodeDatabaseJson(obj: any): string {
    return JSON.stringify(obj)
        .replace(/\\u0000/g , ' ');
}

export function encodeDatabaseArray(array: any[]): string {
    const data = array.map(x => {
        if (typeof x === 'string') {
            return x.replace(/"/g, '');
        }
        return x;
    });
    console.log('data', data);
    return `ARRAY[${data.join(',')}]`;
}

export function encodeString(txt: string): string {
    return txt?.replace(/\\u0000/g , '')?.replace(/\0/g, '') || '';
}

export async function getAllScopesFromTable(rpc: JsonRpc, options: any, batchSize: number): Promise<GetTableByScopeResultRow[]> {
    let result = await rpc.get_table_by_scope({...options, limit: batchSize});

    let { rows } = result;
    while (result.more) {
        const lower_bound = result.more;
        // eslint-disable-next-line no-await-in-loop
        result = await rpc.get_table_by_scope({...options, lower_bound, limit: batchSize});
        rows = rows.concat(result.rows);
    }
    return rows;
}

export async function getAllRowsFromTable(rpc: JsonRpc, options: any, batchSize: number): Promise<any[]> {
    let result = await rpc.get_table_rows({...options, limit: batchSize});
    let { rows } = result;
    while (result.more) {
        const lower_bound = result.next_key;
        // eslint-disable-next-line no-await-in-loop
        result = await rpc.get_table_rows({...options, lower_bound, limit: batchSize});
        rows = rows.concat(result.rows);
    }
    return rows;
}

export function bulkInsert(database: PostgresConnection, tableName: string, rows: any[], batchSize = 1000): Promise<QueryResult[]> {
    if (rows.length === 0) {
        throw new Error('Unable to insert empty rows');
    }
    const keys = Object.keys(rows[0]);
    const chunks = arrayChunk(rows, batchSize);
    return Promise.all(chunks.map(insertRows => {
        let varCounter = 0;
        const valuePlaceholders = insertRows.map(() =>
            `(${keys.map(() => '$' + (++varCounter)).join(',')})`
        ).join(',');

        const values = insertRows.flatMap((row: { [x: string]: any }) => keys.map((key) => row[key] ));
        return database.query(
            `INSERT INTO ${tableName} (` +
            keys.join(',') +
            ') VALUES ' + valuePlaceholders,
            values
        );
    }));
}

export const getDifference = <T>(a: T[], b: T[]): T[] => {
    return [...new Set<T>(a)].filter((element) => {
        return !b.includes(element);
    });
};
