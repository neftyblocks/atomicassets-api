import { PoolClient, QueryResult } from 'pg';
import AwaitLock from 'await-lock';
// @ts-ignore
import * as exitHook from 'async-exit-hook';

import ConnectionManager from '../connections/manager';
import { ShipBlock } from '../types/ship';
import { eosioTimestampToDate } from '../utils/eosio';
import { arrayChunk, arraysEqual } from '../utils';
import logger from '../utils/winston';
import { EosioActionTrace, EosioTransaction } from '../types/eosio';
import { encodeDatabaseJson } from './utils';

export type Condition = {
    str: string,
    values: any[]
};

type SerializedValue = {
    type: string,
    data: any
};

function changeQueryVarOffset(str: string, length: number, offset: number): string {
    let queryStr = str;

    for (let i = length; i > 0; i--) {
        queryStr = queryStr.replace('$' + i, '$' + (offset + i));
    }

    return queryStr;
}

function removeIdenticalValues(
    currentValues: {[key: string]: any}, previousValues: {[key: string]: any}, primaryKey: string[] = []
): {[key: string]: any} {
    const keys = Object.keys(currentValues);
    const result: {[key: string]: any} = {};

    for (const key of keys) {
        if (primaryKey.indexOf(key) >= 0) {
            continue;
        }

        if (compareValues(currentValues[key], previousValues[key])) {
            continue;
        }

        result[key] = currentValues[key];
    }

    return result;
}

function serializeValue(value: any): SerializedValue {
    if (value instanceof Buffer) {
        return {
            type: 'bytes',
            data: [...value]
        };
    }

    if (ArrayBuffer.isView(value)) {
        return {
            type: 'bytes',
            data: [...Buffer.from(value.buffer, value.byteOffset, value.byteLength)]
        };
    }

    if (value instanceof Date) {
        return {
            type: 'date',
            data: value.getTime()
        };
    }

    return {
        type: 'raw',
        data: value
    };
}

function deserializeValue(value: SerializedValue): any {
    if (value.type === 'bytes') {
        return new Uint8Array(value.data);
    }

    if (value.type === 'date') {
        return new Date(value.data);
    }

    return value.data;
}

function compareValues(value1: any, value2: any): boolean {
    const serializedValue1 = serializeValue(value1);
    const serializedValue2 = serializeValue(value2);

    if (serializedValue1.type !== serializedValue2.type) {
        return false;
    }

    if (serializedValue1.type === 'bytes' && arraysEqual(serializedValue1.data, serializedValue2.data)) {
        return true;
    }

    if (serializedValue1.type === 'raw' && JSON.stringify(serializedValue1.data) === JSON.stringify(serializedValue2.data)) {
        return true;
    }

    return serializedValue1.data === serializedValue2.data;
}

function buildPrimaryCondition(values: {[key: string]: any}, primaryKey: string[], offset: number = 0): Condition {
    const conditionStr = primaryKey.map((key, index) => {
        return '"' + key + '" = $' + (offset + index + 1);
    }).join(' AND ');
    const conditionValues = primaryKey.map((key) => values[key]);

    return { str: conditionStr, values: conditionValues };
}

export class ContractDB {
    static transactions: ContractDBTransaction[] = [];

    public stats: {operations: number};

    constructor(readonly name: string, readonly connection: ConnectionManager) {
        this.stats = {operations: 0};
    }

    async startTransaction(currentBlock?: number): Promise<ContractDBTransaction> {
        const client = await this.connection.database.pool.connect();

        this.stats.operations = this.stats.operations % Math.pow(2, 32);

        return new ContractDBTransaction(client, this.name, this.stats, currentBlock);
    }

    async fetchAbi(contract: string, blockNum: number): Promise<{data: Uint8Array, block_num: number} | null> {
        const query = await this.connection.database.query(
            'SELECT block_num, abi FROM contract_abis WHERE account = $1 AND block_num <= $2 ORDER BY block_num DESC LIMIT 1',
            [contract, blockNum]
        );

        if (query.rows.length === 0) {
            return null;
        }

        return {
            data: query.rows[0].abi,
            block_num: parseInt(query.rows[0].block_num, 10)
        };
    }

    async fetchNextAbi(contract: string, blockNum: number): Promise<{data: Uint8Array, block_num: number} | null> {
        const query = await this.connection.database.query(
            'SELECT block_num, abi FROM contract_abis WHERE account = $1 AND block_num > $2 ORDER BY block_num ASC LIMIT 1',
            [contract, blockNum]
        );

        if (query.rows.length === 0) {
            return null;
        }

        return {
            data: query.rows[0].abi,
            block_num: parseInt(query.rows[0].block_num, 10)
        };
    }

    async getReaderPosition(): Promise<{ live: boolean, block_num: number, updated: number }> {
        const query = await this.connection.database.query('SELECT live, block_num, updated FROM contract_readers WHERE name = $1', [this.name]);

        if (query.rows.length === 0) {
            return {
                live: false,
                block_num: 0,
                updated: 0
            };
        }

        return {
            live: query.rows[0].live,
            block_num: parseInt(query.rows[0].block_num, 10),
            updated: parseInt(query.rows[0].updated, 10)
        };
    }

    async getLastReaderBlocks(): Promise<Array<{block_num: number, block_id: string}>> {
        const query = await this.connection.database.query(
            'SELECT block_num, encode(block_id::bytea, \'hex\') block_id FROM reversible_blocks WHERE reader = $1 ORDER BY block_num ASC',
            [this.name]
        );

        return query.rows;
    }
}

export class ContractDBTransaction {
    readonly lock: AwaitLock;

    inTransaction: boolean;
    committed: boolean;

    actionLogs: any[];

    constructor(
        readonly client: PoolClient, readonly name: string, readonly stats: {operations: number}, readonly currentBlock?: number
    ) {
        this.lock = new AwaitLock();
        this.committed = false;
        this.inTransaction = false;

        this.actionLogs = [];
    }

    async begin(): Promise<void> {
        if (this.inTransaction) {
            return;
        }

        this.inTransaction = true;

        await this.clientQuery('BEGIN');

        ContractDB.transactions.push(this);
    }

    async query(queryStr: string, values: any[] = [], lock: boolean = true): Promise<QueryResult> {
        await this.acquireLock(lock);

        try {
            await this.begin();

            return await this.clientQuery(queryStr, values);
        } finally {
            this.releaseLock(lock);
        }
    }

    async insert(
        table: string, values: Record<string, any>, primaryKey: string[], reversible: boolean = true, lock: boolean = true
    ): Promise<QueryResult> {
        await this.acquireLock(lock);

        try {
            await this.begin();

            let insertValues: {[key: string]: any}[];

            if (!Array.isArray(values)) {
                insertValues = [values];
            } else {
                insertValues = values;
            }

            if (insertValues.length === 0 || typeof insertValues[0] !== 'object') {
                throw new Error('ContractDB invalid insert values');
            }

            const keys = Object.keys(insertValues[0]);
            const queryValues = [];
            const queryRows = [];

            let varCounter = 1;

            for (const vals of insertValues) {
                if (!arraysEqual(keys, Object.keys(vals))) {
                    throw new Error('Different insert keys on mass insert');
                }

                const rowVars = [];

                for (const key of keys) {
                    queryValues.push(vals[key]);
                    rowVars.push('$' + varCounter);
                    varCounter += 1;
                }

                queryRows.push('(' + rowVars.join(', ') + ')');
            }

            let queryStr = 'INSERT INTO ' + this.client.escapeIdentifier(table) + ' ';
            queryStr += '(' + keys.map(this.client.escapeIdentifier).join(', ') + ') ';
            queryStr += 'VALUES ' + queryRows.join(', ') + ' ';

            if (primaryKey.length > 0) {
                queryStr += 'RETURNING ' + primaryKey.map(key => this.client.escapeIdentifier(key)).join(', ') + ' ';
            }

            queryStr += ';';

            const query = await this.clientQuery(queryStr, queryValues);

            this.stats.operations += query.rowCount;

            if (primaryKey.length > 0 && this.currentBlock && reversible) {
                const rollbacks = [];

                for (const row of query.rows) {
                    rollbacks.push(this.buildRollbackQuery('delete', table, null, buildPrimaryCondition(row, primaryKey)));
                }

                await this.saveRollbackQueries(rollbacks);
            }

            return query;
        } finally {
            this.releaseLock(lock);
        }
    }

    async update(
        table: string, values: {[key: string]: any}, condition: Condition,
        primaryKey: string[], reversible: boolean = true, lock: boolean = true
    ): Promise<QueryResult> {
        await this.acquireLock(lock);

        try {
            await this.begin();

            let selectQuery = null;
            if (this.currentBlock && reversible) {
                const selectKeys = Object.keys(values);

                for (const key of primaryKey) {
                    if (selectKeys.indexOf(key) === -1) {
                        selectKeys.push(key);
                    }
                }

                selectQuery = await this.clientQuery(
                    'SELECT ' + selectKeys.map(key => '"' + key + '"').join(', ') + ' FROM ' + this.client.escapeIdentifier(table) + ' WHERE ' + condition.str + ';', condition.values
                );
            }

            const keys = Object.keys(values);
            const queryUpdates = [];

            let queryValues = [];
            let varCounter = 0;

            for (const key of keys) {
                if (primaryKey.indexOf(key) >= 0) {
                    continue;
                }

                varCounter += 1;
                queryUpdates.push('' + this.client.escapeIdentifier(key) + ' = $' + varCounter);
                queryValues.push(values[key]);
            }

            let queryStr = 'UPDATE ' + this.client.escapeIdentifier(table) + ' SET ';
            queryStr += queryUpdates.join(', ') + ' ';
            queryStr += 'WHERE ' + changeQueryVarOffset(condition.str, condition.values.length, varCounter) + ' ';

            if (primaryKey.length > 0) {
                queryStr += 'RETURNING ' + primaryKey.map(key => this.client.escapeIdentifier(key)).join(', ') + ' ';
            }

            queryValues = queryValues.concat(condition.values);

            const query = await this.clientQuery(queryStr, queryValues);

            this.stats.operations += query.rowCount;

            if (query.rowCount === 0) {
                throw new Error('Table ' + table + ' updated but no rows affacted ' + JSON.stringify(values) + ' ' + JSON.stringify(condition));
            }

            if (selectQuery && selectQuery.rows.length > 0) {
                const rollbacks = [];

                for (const row of selectQuery.rows) {
                    const filteredValues = removeIdenticalValues(row, values, primaryKey);

                    if (Object.keys(filteredValues).length === 0) {
                        continue;
                    }

                    rollbacks.push(await this.buildRollbackQuery('update', table, filteredValues, buildPrimaryCondition(row, primaryKey)));
                }

                await this.saveRollbackQueries(rollbacks);
            }

            return query;
        } finally {
            this.releaseLock(lock);
        }
    }

    async delete(
        table: string, condition: Condition, reversible: boolean = true, lock: boolean = true
    ): Promise<QueryResult> {
        await this.acquireLock(lock);

        try {
            await this.begin();

            let selectQuery;
            if (this.currentBlock && reversible) {
                selectQuery = await this.clientQuery(
                    'SELECT * FROM ' + this.client.escapeIdentifier(table) + ' WHERE ' + condition.str + ';', condition.values
                );
            }

            const queryStr = 'DELETE FROM ' + this.client.escapeIdentifier(table) + ' WHERE ' + condition.str + ';';
            const query = await this.clientQuery(queryStr, condition.values);

            this.stats.operations += selectQuery ? selectQuery.rowCount : 1;

            if (selectQuery && selectQuery.rows.length > 0) {
                const rollback = this.buildRollbackQuery('insert', table, selectQuery.rows);

                await this.saveRollbackQueries([rollback]);
            }

            return query;
        } finally {
            this.releaseLock(lock);
        }
    }

    async replace(
        table: string, values: Record<string, any>, primaryKey: string[], updateBlacklist: string[] = [],
        reversible: boolean = true, lock: boolean = true
    ): Promise<QueryResult> {
        await this.acquireLock(lock);

        try {
            await this.begin();

            const condition = buildPrimaryCondition(values, primaryKey);
            const selectQuery = await this.clientQuery(
                'SELECT * FROM ' + this.client.escapeIdentifier(table) + ' WHERE ' + condition.str + ' LIMIT 1;', condition.values
            );

            if (selectQuery.rows.length > 0) {
                const updateValues: {[key: string]: any} = {...values};

                for (const key of updateBlacklist) {
                    delete updateValues[key];
                }

                for (const key of primaryKey) {
                    delete updateValues[key];
                }

                await this.update(table, updateValues, condition, primaryKey, false, false);

                if (this.currentBlock && reversible) {
                    const filteredValues = removeIdenticalValues(selectQuery.rows[0], updateValues, primaryKey);

                    if (Object.keys(filteredValues).length > 0) {
                        const rollback = await this.buildRollbackQuery('update', table, filteredValues, condition);

                        await this.saveRollbackQueries([rollback]);
                    }
                }
            } else {
                return await this.insert(table, values, primaryKey, reversible, false);
            }
        } finally {
            this.releaseLock(lock);
        }
    }

    async saveRollbackQueries(data: any[]): Promise<void> {
        if (data.length === 0) {
            return;
        }

        const chunks = arrayChunk(data, 100);

        for (const chunk of chunks) {
            await this.insert('reversible_queries', chunk, [], false, false);
        }
    }

    buildRollbackQuery(operation: string, table: string, values: any, condition?: Condition): any {
        let serializedCondition = null;
        if (condition) {
            serializedCondition = {
                str: condition.str,
                values: condition.values.map((value) => serializeValue(value))
            };
        }

        let serializedValues: any = null;
        if (Array.isArray(values)) {
            serializedValues = [];

            for (const value of values) {
                const row = {...value};

                for (const key of Object.keys(value)) {
                    row[key] = serializeValue(value[key]);
                }

                serializedValues.push(row);
            }
        } else if (values) {
            serializedValues = {...values};

            for (const key of Object.keys(serializedValues)) {
                serializedValues[key] = serializeValue(values[key]);
            }
        }

        return {
            operation, table,
            values: JSON.stringify(serializedValues),
            condition: JSON.stringify(serializedCondition),
            block_num: this.currentBlock, reader: this.name
        };
    }

    async rollbackReversibleBlocks(blockNum: number, lock: boolean = true): Promise<void> {
        await this.acquireLock(lock);

        try {
            await this.begin();

            const query = await this.clientQuery(
                'SELECT operation, "table", "values", condition ' +
                'FROM reversible_queries WHERE block_num >= $1 AND reader = $2' +
                'ORDER BY block_num DESC, id DESC;',
                [blockNum, this.name]
            );

            logger.info('Rollback ' + query.rowCount + ' operations until block #' + blockNum);

            const startTime = Date.now();

            let counter = 0;
            let lastProgressMessage = Date.now();

            for (const row of query.rows) {
                const values = row.values;
                const condition: Condition | null = row.condition;

                if (condition) {
                    condition.values = condition.values.map((value) => deserializeValue(value));
                }

                if (values !== null) {
                    if (Array.isArray(values)) {
                        for (const value of values) {
                            for (const key of Object.keys(value)) {
                                value[key] = deserializeValue(value[key]);
                            }
                        }
                    } else {
                        for (const key of Object.keys(values)) {
                            values[key] = deserializeValue(values[key]);
                        }
                    }
                }

                if (Date.now() - startTime >= 30000) {
                    logger.warn('Fork rollback taking longer than expected. Executing query...', {
                        operation: row.operation,
                        table: row.table,
                        values, condition
                    });
                }

                if (row.operation === 'insert') {
                    await this.insert(row.table, values, [], false, false);
                } else if (row.operation === 'update') {
                    await this.update(row.table, values, condition, [], false, false);
                } else if (row.operation === 'delete') {
                    await this.delete(row.table, condition, false, false);
                } else {
                    throw Error('Invalid rollback operation in database');
                }

                counter += 1;

                if (Date.now() - lastProgressMessage >= 5000) {
                    logger.info('Executed rollback query ' + counter + ' / ' + query.rowCount);

                    lastProgressMessage = Date.now();
                }
            }

            await this.clientQuery(
                'DELETE FROM reversible_queries WHERE block_num >= $1 AND reader = $2;',
                [blockNum, this.name]
            );

            await this.clientQuery(
                'DELETE FROM reversible_blocks WHERE block_num >= $1 AND reader = $2;',
                [blockNum, this.name]
            );

            await this.clientQuery(
                'UPDATE contract_readers SET block_num = $1 WHERE name = $2;',
                [blockNum - 1, this.name]
            );
        } finally {
            this.releaseLock(lock);
        }
    }

    async clearForkDatabase(lastIrreversibleBlock: number, lock: boolean = true): Promise<void> {
        await this.acquireLock(lock);

        try {
            await this.begin();

            await this.clientQuery(
                'DELETE FROM reversible_queries WHERE block_num <= $1 AND reader = $2',
                [lastIrreversibleBlock, this.name]
            );

            await this.clientQuery(
                'DELETE FROM reversible_blocks WHERE block_num <= $1 AND reader = $2',
                [lastIrreversibleBlock, this.name]
            );
        } finally {
            this.releaseLock(lock);
        }
    }

    async updateReaderPosition(block: ShipBlock, live: boolean, lock: boolean = true): Promise<void> {
        await this.acquireLock(lock);

        try {
            await this.begin();

            await this.clientQuery(
                'UPDATE contract_readers SET block_num = $1, block_time = $2, updated = $3, live = $4 WHERE name = $5',
                [block.block_num, eosioTimestampToDate(block.timestamp).getTime(), Date.now(), live, this.name]
            );
        } finally {
            this.releaseLock(lock);
        }
    }

    async logTrace(block: ShipBlock, tx: EosioTransaction, trace: EosioActionTrace, metadata: any): Promise<void> {
        this.actionLogs.push({
            global_sequence: trace.global_sequence,
            account: trace.act.account,
            name: trace.act.name,
            metadata: encodeDatabaseJson(metadata),
            txid: Buffer.from(tx.id, 'hex'),
            created_at_block: block.block_num,
            created_at_time: eosioTimestampToDate(block.timestamp).getTime()
        });
    }

    async commit(): Promise<void> {
        if (this.actionLogs.length > 0) {
            const chunks = arrayChunk(this.actionLogs, 100);

            for (const chunk of chunks) {
                await this.insert('contract_traces', chunk, ['global_sequence', 'account']);
            }

            this.actionLogs = [];
        }

        await this.acquireLock();

        try {
            if (this.inTransaction) {
                await this.clientQuery('COMMIT');
            }
        } finally {
            this.client.release();

            this.releaseLock();

            const index = ContractDB.transactions.indexOf(this);

            if (index >= 0) {
                ContractDB.transactions.splice(index, 1);
            }
        }
    }

    async abort(): Promise<void> {
        await this.acquireLock();

        try {
            if (this.inTransaction) {
                await this.clientQuery('ROLLBACK');
            }
        } finally {
            this.releaseLock();
            this.client.release();

            const index = ContractDB.transactions.indexOf(this);
            if (index >= 0) {
                ContractDB.transactions.splice(index, 1);
            }
        }
    }

    private async clientQuery(queryText: string, values: any[] = []): Promise<QueryResult> {
        try {
            logger.debug('contract db query: ' + queryText, values);

            return await this.client.query(queryText, values);
        } catch (error) {
            logger.error('Failed to execute SQL query ', {queryText, values, error});

            throw error;
        }
    }

    private async acquireLock(lock: boolean = true): Promise<void> {
        if (!lock) {
            return;
        }

        await this.lock.acquireAsync();
    }

    private releaseLock(lock: boolean = true): void {
        if (!lock) {
            return;
        }

        this.lock.release();
    }
}

exitHook(async (callback: () => void) => {
    logger.info('Process stopping - cleaning up transactions...');

    for (const transaction of ContractDB.transactions) {
        await transaction.abort();
    }

    logger.info('All transactions aborted');

    callback();
});
