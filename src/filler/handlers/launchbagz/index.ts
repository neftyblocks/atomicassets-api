import * as fs from 'fs';
import { PoolClient } from 'pg';

import { ContractHandler } from '../interfaces';
import logger from '../../../utils/winston';
import Filler from '../../filler';
import { ATOMICASSETS_BASE_PRIORITY } from '../atomicassets';
import DataProcessor from '../../processor';
import {launchesProcessor} from './processors/launches';
import {imagesProcessor} from './processors/images';
import {feesProcessor} from './processors/fees';
import {initVestings, vestingsProcessor} from './processors/vestings';
import {farmsProcessor, initFarms, initStakers} from './processors/farms';

export const LAUNCHES_BASE_PRIORITY = ATOMICASSETS_BASE_PRIORITY + 3000;

export type LaunchesArgs = {
    launch_account: string,
    registry_account: string,
    collection_name: string,
    vestings_account: string,
    farms_account: string,
};

export enum LaunchesUpdatePriority {
    LOG_NEW_LAUNCH = LAUNCHES_BASE_PRIORITY + 10,
    LOG_NEW_BLEND = LAUNCHES_BASE_PRIORITY + 20,
    TABLE_LAUNCHES = LAUNCHES_BASE_PRIORITY + 30,
    TABLE_IMAGES = LAUNCHES_BASE_PRIORITY + 30,
    TABLE_CONFIGS = LAUNCHES_BASE_PRIORITY + 40,
    LOG_NEW_VESTING = LAUNCHES_BASE_PRIORITY + 30,
    LOG_CLAIM_VESTING = LAUNCHES_BASE_PRIORITY + 40,
    TABLE_VESTINGS = LAUNCHES_BASE_PRIORITY + 50,
    TABLE_TOKEN_FARM = LAUNCHES_BASE_PRIORITY + 50,
    TABLE_TOKEN_FARM_REWARDS = LAUNCHES_BASE_PRIORITY + 60,
    ACTION_NEW_PARTNER_FARM = LAUNCHES_BASE_PRIORITY + 70,
    TABLE_TOKEN_FARM_PARTNERS = LAUNCHES_BASE_PRIORITY + 80,
    TABLE_TOKEN_FARM_STAKERS = LAUNCHES_BASE_PRIORITY + 80,
}

const views: string[] = [
    'launchbagz_farms_master',
];
const functions: string[] = [];

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

    static async upgrade(client: PoolClient, version: string): Promise<void> {
        if (version === '1.3.67' || version === '1.3.69') {
            await client.query(fs.readFileSync('./definitions/views/launchbagz_farms_master.sql', { encoding: 'utf8' }));
        }
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
        await initVestings(this.args, this.connection);
        await initFarms(this.args, this.connection);
        await initStakers(this.args, this.connection);
    }

    async deleteDB(client: PoolClient): Promise<void> {
        await client.query(
            'DELETE FROM ' + client.escapeIdentifier('launchbagz_launches') + ' WHERE contract = $1',
            [this.args.launch_account]
        );

        await client.query(
            'DELETE FROM ' + client.escapeIdentifier('launchbagz_tokens') + ' WHERE contract = $1',
            [this.args.registry_account]
        );

        await client.query(
            'DELETE FROM ' + client.escapeIdentifier('launchbagz_vestings') + ' WHERE contract = $1',
            [this.args.vestings_account]
        );

        await client.query(
            'DELETE FROM ' + client.escapeIdentifier('launchbagz_farm_rewards') + ' WHERE contract = $1',
            [this.args.farms_account]
        );

        await client.query(
            'DELETE FROM ' + client.escapeIdentifier('launchbagz_farms') + ' WHERE contract = $1',
            [this.args.farms_account]
        );

        await client.query(
            'DELETE FROM ' + client.escapeIdentifier('launchbagz_farms_partners') + ' WHERE contract = $1',
            [this.args.farms_account]
        );
    }

    async register(processor: DataProcessor): Promise<() => any> {
        const destructors: Array<() => any> = [];
        destructors.push(launchesProcessor(this, processor));
        destructors.push(imagesProcessor(this, processor));
        destructors.push(feesProcessor(this, processor));
        destructors.push(vestingsProcessor(this, processor));
        destructors.push(farmsProcessor(this, processor));
        return (): any => destructors.map(fn => fn());
    }
}
