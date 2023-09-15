import * as fs from 'fs';
import { PoolClient } from 'pg';

import { ContractHandler } from '../interfaces';
import logger from '../../../utils/winston';
import Filler from '../../filler';
import { ATOMICASSETS_BASE_PRIORITY } from '../atomicassets';
import DataProcessor from '../../processor';
import { blendsProcessor, initBlends } from './processors/blends';
import {initPfps, pfpsProcessor} from './processors/pfps';
import {initPhotos, photosProcessor} from './processors/photos';

export const AVATARS_BASE_PRIORITY = ATOMICASSETS_BASE_PRIORITY + 4000;

export type AvatarsArgs = {
    avatar_account: string,
    pfp_account: string,
    photos_account: string,
};

export enum AvatarUpdatePriority {
    TABLE_BLENDS = AVATARS_BASE_PRIORITY + 10,
    TABLE_PFP = AVATARS_BASE_PRIORITY + 30,
    TABLE_PHOTOS = AVATARS_BASE_PRIORITY + 40,
}

const views: string[] = [];

const functions: string[] = [];

export default class AvatarsHandler extends ContractHandler {
    static handlerName = 'avatars';

    declare readonly args: AvatarsArgs;

    static async setup(client: PoolClient): Promise<boolean> {
        const existsQuery = await client.query(
            'SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2)',
            ['public', 'neftyavatars_blends']
        );

        if (!existsQuery.rows[0].exists) {
            logger.info('Could not find Avatars tables. Creating them now...');

            await client.query(fs.readFileSync('./definitions/tables/avatars_tables.sql', {
                encoding: 'utf8'
            }));

            for (const view of views) {
                await client.query(fs.readFileSync('./definitions/views/' + view + '.sql', {encoding: 'utf8'}));
            }

            for (const fn of functions) {
                await client.query(fs.readFileSync('./definitions/functions/' + fn + '.sql', {encoding: 'utf8'}));
            }

            logger.info('Avatars tables successfully created');
            return true;
        }

        return false;
    }

    static async upgrade(): Promise<void> {
    }

    constructor(filler: Filler, args: {[key: string]: any}) {
        super(filler, args);

        if (typeof args.avatar_account !== 'string') {
            throw new Error('Avatars: Argument missing in helpers handler: avatar_account');
        }

        if (typeof args.pfp_account !== 'string') {
            throw new Error('Avatars: Argument missing in helpers handler: pfp_account');
        }
    }

    async init(): Promise<void> {
        try {
            await this.connection.database.begin();
            await initBlends(this.args, this.connection);
            await initPfps(this.args, this.connection);
            await initPhotos(this.args, this.connection);
            await this.connection.database.query('COMMIT');
        } catch (error) {
            await this.connection.database.query('ROLLBACK');
            throw error;
        }
    }

    async deleteDB(client: PoolClient): Promise<void> {
        const tables = [
            'neftyavatars_blends',
            'neftyavatars_pfps',
            'profile_photos',
        ];

        for (const table of tables) {
            await client.query(
                'DELETE FROM ' + client.escapeIdentifier(table),
            );
        }
    }

    async register(processor: DataProcessor): Promise<() => any> {
        const destructors: Array<() => any> = [];
        destructors.push(blendsProcessor(this, processor));
        destructors.push(pfpsProcessor(this, processor));
        destructors.push(photosProcessor(this, processor));
        return (): any => destructors.map(fn => fn());
    }
}
