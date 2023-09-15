import * as fs from 'fs';
import { PoolClient } from 'pg';

import { ContractHandler } from '../interfaces';
import logger from '../../../utils/winston';
import Filler from '../../filler';
import { ATOMICASSETS_BASE_PRIORITY } from '../atomicassets';
import DataProcessor from '../../processor';
import {initPacks, packsProcessor} from './processors/packs';

export const PACKS_BASE_PRIORITY = ATOMICASSETS_BASE_PRIORITY + 3000;

export type PacksArgs = {
    atomicassets_account: string,
    nefty_packs_account: string,
    atomic_packs_account: string,
};

export enum PacksUpdatePriority {
    TABLE_PACKS = PACKS_BASE_PRIORITY + 10,
}

export default class PacksHandler extends ContractHandler {
    static handlerName = 'neftypacks';

    declare readonly args: PacksArgs;

    static async setup(client: PoolClient): Promise<boolean> {
        const existsQuery = await client.query(
            'SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2)',
            ['public', 'neftypacks_packs']
        );

        if (!existsQuery.rows[0].exists) {
            logger.info('Could not find Packs tables. Creating them now...');

            await client.query(fs.readFileSync('./definitions/tables/packs_tables.sql', {
                encoding: 'utf8'
            }));

            logger.info('Packs tables successfully created');
            return true;
        }

        return false;
    }

    static async upgrade(client: PoolClient, version: string): Promise<void> {

    }

    constructor(filler: Filler, args: {[key: string]: any}) {
        super(filler, args);

        if (typeof args.atomicassets_account !== 'string') {
            throw new Error('Packs: Argument missing in helpers handler: atomicassets_account');
        }

        if (typeof args.nefty_packs_account !== 'string') {
            throw new Error('Packs: Argument missing in helpers handler: nefty_packs_account');
        }

        if (typeof args.atomic_packs_account !== 'string') {
            throw new Error('Packs: Argument missing in helpers handler: atomic_packs_account');
        }
    }

    async init(): Promise<void> {
        try {
            await this.connection.database.begin();
            await initPacks(this.args, this.connection);
            await this.connection.database.query('COMMIT');
        } catch (error) {
            await this.connection.database.query('ROLLBACK');
            throw error;
        }
    }

    async deleteDB(client: PoolClient): Promise<void> {
        const tables = [
            'neftypacks_packs',
        ];

        for (const table of tables) {
            await client.query(
                'DELETE FROM ' + client.escapeIdentifier(table) + ' WHERE assets_contract = $1',
                [this.args.atomicassets_account]
            );
        }
    }

    async register(processor: DataProcessor): Promise<() => any> {
        const destructors: Array<() => any> = [];
        destructors.push(packsProcessor(this, processor));
        return (): any => destructors.map(fn => fn());
    }
}
