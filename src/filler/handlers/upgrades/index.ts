import * as fs from 'fs';
import { PoolClient } from 'pg';

import { ContractHandler } from '../interfaces';
import logger from '../../../utils/winston';
import Filler from '../../filler';
import { ATOMICASSETS_BASE_PRIORITY } from '../atomicassets';
import DataProcessor from '../../processor';
import {upgradesProcessor, initUpgrades} from './processors/upgrades';
import {ConfigTableRow} from './types/tables';
import {configProcessor} from './processors/config';
import {bulkInsert} from '../../utils';

export const UPGRADES_BASE_PRIORITY = ATOMICASSETS_BASE_PRIORITY + 3000;

export type UpgradesArgs = {
    atomicassets_account: string,
    upgrades_account: string,
    store_config: boolean,
};

export enum UpgradeIngredientType {
    TEMPLATE_INGREDIENT = 'TEMPLATE_INGREDIENT',
    ATTRIBUTE_INGREDIENT = 'ATTRIBUTE_INGREDIENT',
    SCHEMA_INGREDIENT = 'SCHEMA_INGREDIENT',
    COLLECTION_INGREDIENT = 'COLLECTION_INGREDIENT',
    BALANCE_INGREDIENT = 'BALANCE_INGREDIENT',
    TYPED_ATTRIBUTE_INGREDIENT = 'TYPED_ATTRIBUTE_INGREDIENT',
    FT_INGREDIENT = 'FT_INGREDIENT',
    COOLDOWN_INGREDIENT = 'COOLDOWN_INGREDIENT',
}

export enum UpgradeRequirementType {
    TEMPLATE_REQUIREMENT = 'TEMPLATE_REQUIREMENT',
    TEMPLATES_REQUIREMENT = 'TEMPLATES_REQUIREMENT',
    TYPED_ATTRIBUTE_REQUIREMENT = 'TYPED_ATTRIBUTE_REQUIREMENT',
}

export enum UpgradeOperator {
    ASSIGNMENT = 0,
    ADD_ASSIGN = 1,
}

export enum UpgradeRequirementComparator {
    EQUALS = 0,
}

export enum ResultValueType {
    IMMEDIATE_VALUE = 'IMMEDIATE_VALUE',
}

export enum IngredientEffectType {
    TYPED_EFFECT = 'TYPED_EFFECT',
    TRANSFER_EFFECT = 'TRANSFER_EFFECT',
}

export enum UpgradeImmediateType {
    STRING = 'string',
    UINT64 = 'uint64'
}

export enum UpgradesUpdatePriority {
    TABLE_UPGRADES = UPGRADES_BASE_PRIORITY + 10,
    SET_MIX = UPGRADES_BASE_PRIORITY + 21,
    TABLE_CONFIG = UPGRADES_BASE_PRIORITY + 30,
    LOG_CLAIM = UPGRADES_BASE_PRIORITY + 50,
    LOG_RESULT = UPGRADES_BASE_PRIORITY + 60,
}

const views = [
    'neftyupgrades_upgrade_details_master'
];

const functions = [
    'neftyupgrades_attribute_match',
];

export default class UpgradesHandler extends ContractHandler {
    static handlerName = 'upgrades';

    declare readonly args: UpgradesArgs;

    config: ConfigTableRow;

    static async setup(client: PoolClient): Promise<boolean> {
        const existsQuery = await client.query(
            'SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2)',
            ['public', 'neftyupgrades_upgrades']
        );

        if (!existsQuery.rows[0].exists) {
            logger.info('Could not find Upgrades tables. Creating them now...');

            await client.query(fs.readFileSync('./definitions/tables/upgrades_tables.sql', {
                encoding: 'utf8'
            }));

            logger.info('Upgrades tables successfully created');

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
        if (version === '1.3.72') {
            for (const view of views) {
                logger.info(`Refreshing views ${view}`);
                await client.query(fs.readFileSync('./definitions/views/' + view + '.sql', {encoding: 'utf8'}));
            }
        }
    }

    constructor(filler: Filler, args: {[key: string]: any}) {
        super(filler, args);

        if (typeof args.atomicassets_account !== 'string') {
            throw new Error('Upgrades: Argument missing in helpers handler: atomicassets_account');
        }

        if (typeof args.upgrades_account !== 'string') {
            throw new Error('Upgrades: Argument missing in helpers handler: upgrades_account');
        }
    }

    async init(client: PoolClient): Promise<void> {
        try {
            await this.connection.database.begin();
            await initUpgrades(this.args, this.connection);

            if (this.args.store_config) {
                const configQuery = await client.query(
                    'SELECT * FROM neftyupgrades_config WHERE contract = $1',
                    [this.args.upgrades_account]
                );

                if (configQuery.rows.length === 0) {
                    const configTable = await this.connection.chain.rpc.get_table_rows({
                        json: true, code: this.args.upgrades_account,
                        scope: this.args.upgrades_account, table: 'config'
                    });

                    if (configTable.rows.length === 0) {
                        logger.warn('Upgrades: Unable to fetch config');
                        this.config = {
                            fee: 0,
                            fee_recipient: '',
                            supported_tokens: [],
                        };
                        return;
                    }

                    const config: ConfigTableRow = configTable.rows[0];

                    await client.query(
                        'INSERT INTO neftyupgrades_config ' +
                        '(' +
                        'contract, fee, fee_recipient) ' +
                        'VALUES ($1, $2, $3)',
                        [
                            this.args.upgrades_account,
                            config.fee,
                            config.fee_recipient,
                        ]
                    );

                    this.config = {
                        ...config,
                        supported_tokens: config.supported_tokens,
                    };

                    const rows = config.supported_tokens.map(token => ({
                        contract: this.args.upgrades_account,
                        token_contract: token.contract,
                        token_symbol: token.sym.split(',')[1],
                        token_precision: token.sym.split(',')[0]
                    }));
                    await bulkInsert(this.connection.database, 'neftyupgrades_tokens', rows);
                } else {
                    const tokensQuery = await this.connection.database.query(
                        'SELECT * FROM neftyupgrades_tokens WHERE contract = $1',
                        [this.args.upgrades_account]
                    );

                    this.config = {
                        ...configQuery.rows[0],
                        supported_tokens: tokensQuery.rows.map(row => ({
                            contract: row.token_contract,
                            sym: row.token_precision + ',' + row.token_symbol
                        })),
                    };
                }
            }

            await this.connection.database.query('COMMIT');
        } catch (error) {
            await this.connection.database.query('ROLLBACK');
            throw error;
        }
    }

    async deleteDB(client: PoolClient): Promise<void> {
        const tables = [
            'neftyupgrades_upgrade_specs_results',
            'neftyupgrades_upgrade_specs_requirements',
            'neftyupgrades_upgrade_specs',
            'neftyupgrades_upgrade_ingredient_attributes',
            'neftyupgrades_upgrade_ingredients',
            'neftyupgrades_upgrades',
            'neftyupgrades_config',
            'neftyupgrades_tokens',
            'neftyupgrades_fusions',
            'neftyupgrades_claims',
        ];

        for (const table of tables) {
            await client.query(
                'DELETE FROM ' + client.escapeIdentifier(table) + ' WHERE contract = $1',
                [this.args.upgrades_account]
            );
        }
    }

    async register(processor: DataProcessor): Promise<() => any> {
        const destructors: Array<() => any> = [];
        destructors.push(upgradesProcessor(this, processor));

        if (this.args.store_config) {
            destructors.push(configProcessor(this, processor));
        }
        return (): any => destructors.map(fn => fn());
    }
}
