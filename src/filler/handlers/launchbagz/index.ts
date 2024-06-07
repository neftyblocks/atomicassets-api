import * as fs from 'fs';
import { PoolClient } from 'pg';

import { ContractHandler } from '../interfaces';
import logger from '../../../utils/winston';
import Filler from '../../filler';
import { ATOMICASSETS_BASE_PRIORITY } from '../atomicassets';
import DataProcessor from '../../processor';
import {launchesProcessor} from './processors/launches';

export const LAUNCHES_BASE_PRIORITY = ATOMICASSETS_BASE_PRIORITY + 3000;

export type LaunchesArgs = {
    launch_account: string,
    registry_account: string,
    collection_name: string,
};

export enum LaunchesUpdatePriority {
    LOG_NEW_LAUNCH = LAUNCHES_BASE_PRIORITY + 10,
    LOG_NEW_BLEND = LAUNCHES_BASE_PRIORITY + 20,
    TABLE_LAUNCHES = LAUNCHES_BASE_PRIORITY + 30,
}

const views = [
    ''
];

const functions = [
    '',
];

export default class LaunchesHandler extends ContractHandler {
    static handlerName = 'launchbagz';

    declare readonly args: LaunchesArgs;

    static async setup(client: PoolClient): Promise<boolean> {
        const existsQuery = await client.query(
            'SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2)',
            ['public', 'launchbagz_launches']
        );

        if (!existsQuery.rows[0].exists) {
            logger.info('Could not find Launches tables. Creating them now...');

            await client.query(fs.readFileSync('./definitions/tables/launchbagz_tables.sql', {
                encoding: 'utf8'
            }));

            logger.info('Launches tables successfully created');

            for (const view of views) {
                logger.info(`Creating view ${view}`);
                await client.query(fs.readFileSync('./definitions/views/' + view + '.sql', {encoding: 'utf8'}));
            }
            for (const fn of functions) {
                logger.info(`Creating function ${fn}`);
                await client.query(fs.readFileSync('./definitions/functions/' + fn + '.sql', {encoding: 'utf8'}));
            }

            return true;
        }

        return false;
    }

    static async upgrade(): Promise<void> {
    }

    constructor(filler: Filler, args: {[key: string]: any}) {
        super(filler, args);

        if (typeof args.launch_account !== 'string') {
            throw new Error('Launchbagz: Argument missing in helpers handler: launch_account');
        }

        if (typeof args.registry_account !== 'string') {
            throw new Error('Launchbagz: Argument missing in helpers handler: registry_account');
        }
    }

    async init(): Promise<void> {

    }

    async deleteDB(client: PoolClient): Promise<void> {
        const tables = [
            '',
        ];

        for (const table of tables) {
            await client.query(
                'DELETE FROM ' + client.escapeIdentifier(table) + ' WHERE contract = $1',
                [this.args.registry_account]
            );
        }
    }

    async register(processor: DataProcessor): Promise<() => any> {
        const destructors: Array<() => any> = [];
        destructors.push(launchesProcessor(this, processor));
        return (): any => destructors.map(fn => fn());
    }
}
