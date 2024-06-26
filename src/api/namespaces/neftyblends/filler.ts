import {DB} from '../../server';
import {AssetFiller, FillerHook} from '../atomicassets/filler';
import {formatTemplate, formatSchema, formatCollection, formatAsset} from '../atomicassets/format';
import {BlendResultType} from '../../../filler/handlers/blends';
import {renderMarkdownToHtml} from '../utils';

export class TemplateFiller {
    private templates: Promise<{[key: string]: any}> | null;

    constructor(
        readonly db: DB,
        readonly contract: string,
        readonly templateIds: string[],
        readonly formatter: (_: any) => any,
        readonly view: string,
        readonly hook?: FillerHook
    ) {
        this.templates = null;
    }

    async fill(templateId: string): Promise<any> {
        this.query();

        const data = await this.templates;
        return data[String(templateId)] || String(templateId);
    }

    query(): void {
        if (this.templates !== null) {
            return;
        }

        this.templates = new Promise(async (resolve, reject) => {
            if (this.templateIds.length === 0) {
                return resolve({});
            }

            try {
                const query = await this.db.query(
                    'SELECT * FROM ' + this.view + ' WHERE contract = $1 AND template_id = ANY ($2)',
                    [this.contract, this.templateIds]
                );

                const rows = this.hook ? await this.hook(this.db, this.contract, query.rows) : query.rows;
                const result: {[key: string]: any} = {};

                for (const row of rows) {
                    result[String(row.template_id)] = this.formatter(row);
                }

                return resolve(result);
            } catch (e) {
                return reject(e);
            }
        });
    }
}

export class SchemaFiller {
    private schemas: Promise<{[key: string]: any}> | null;

    constructor(
        readonly db: DB,
        readonly contract: string,
        readonly schemaIds: any[],
        readonly formatter: (_: any) => any,
        readonly view: string,
        readonly hook?: FillerHook
    ) {
        this.schemas = null;
    }

    async fill(collectionName: string, schemaName: string): Promise<any> {
        this.query();

        const data = await this.schemas;
        const key = `${collectionName}-${schemaName}`;
        return data[key] || key;
    }

    query(): void {
        if (this.schemas !== null) {
            return;
        }

        this.schemas = new Promise(async (resolve, reject) => {
            if (this.schemaIds.length === 0) {
                return resolve({});
            }

            try {
                const valuesToJoin = this.schemaIds
                    .map(({collectionName, schemaName}) => `('${collectionName}','${schemaName}')`)
                    .join(',');
                const query = await this.db.query(
                    'SELECT * FROM ' + this.view + ' JOIN(VALUES' + valuesToJoin + ') ' +
                    'AS ids (c,s) ON c = collection_name AND s = schema_name ' +
                    'WHERE contract = $1',
                    [this.contract]
                );

                const rows = this.hook ? await this.hook(this.db, this.contract, query.rows) : query.rows;
                const result: {[key: string]: any} = {};

                for (const row of rows) {
                    const key = `${row.collection_name}-${row.schema_name}`;
                    result[key] = this.formatter(row);
                }

                return resolve(result);
            } catch (e) {
                return reject(e);
            }
        });
    }
}

export class CollectionFiller {
    private collections: Promise<{[key: string]: any}> | null;

    constructor(
        readonly db: DB,
        readonly contract: string,
        readonly collectionNames: any[],
        readonly formatter: (_: any) => any,
        readonly view: string,
        readonly hook?: FillerHook
    ) {
        this.collections = null;
    }

    async fill(collectionName: string): Promise<any> {
        this.query();

        const data = await this.collections;
        return data[collectionName] || collectionName;
    }

    query(): void {
        if (this.collections !== null) {
            return;
        }

        this.collections = new Promise(async (resolve, reject) => {
            if (this.collectionNames.length === 0) {
                return resolve({});
            }

            try {
                const query = await this.db.query(
                    'SELECT * FROM ' + this.view + ' WHERE contract = $1 AND collection_name = ANY ($2)',
                    [this.contract, this.collectionNames]
                );

                const rows = this.hook ? await this.hook(this.db, this.contract, query.rows) : query.rows;
                const result: {[key: string]: any} = {};

                for (const row of rows) {
                    result[String(row.collection_name)] = this.formatter(row);
                }

                return resolve(result);
            } catch (e) {
                return reject(e);
            }
        });
    }
}

export async function fillBlends(db: DB, assetContract: string, blends: any[], renderMarkdown: boolean): Promise<any[]> {
    let templateIds: string[] = [];
    const schemaIds: any[] = [];
    let collectionNames: any[] = [];

    for (const blend of blends) {
        for (const ingredient of blend.ingredients) {
            const templateId = ingredient.template?.template_id;
            const schema = ingredient.schema || ingredient.attributes;
            const collection = ingredient.collection;
            if (templateId) {
                templateIds.push(templateId);
            } else if (schema) {
                schemaIds.push({
                    collectionName: schema.collection_name,
                    schemaName: schema.schema_name,
                });
            } else if (collection) {
                collectionNames.push(collection.collection_name);
            }
        }
        if (blend.rolls) {
            for (const roll of blend.rolls) {
                for (const outcome of roll.outcomes) {
                    for (const result of outcome.results) {
                        const templateId = result.payload?.template_id;
                        if (templateId) {
                            templateIds.push(templateId);
                        }
                    }
                }
            }
        }
        if (renderMarkdown) {
            let displayData: Record<string, any> = {};
            try {
                displayData = JSON.parse(blend.display_data);
                if (displayData.description) {
                    displayData.description = renderMarkdownToHtml(displayData.description);
                }
            } catch (e) {
                // Ignore
            }
            blend.display_data = displayData;
        }
    }

    templateIds = [...new Set(templateIds)];
    collectionNames = [...new Set(collectionNames)];

    const templateFiller = new TemplateFiller(db, assetContract, templateIds, formatTemplate, 'atomicassets_templates_master');
    const schemaFiller = new SchemaFiller(db, assetContract, schemaIds, formatSchema, 'atomicassets_schemas');
    const collectionFiller = new CollectionFiller(db, assetContract, collectionNames, formatCollection, 'atomicassets_collections');
    const filledBlends = [];

    for (const blend of blends) {
        const filledIngredients = [];
        const filledRolls = [];

        for (const ingredient of blend.ingredients) {
            const templateId = ingredient.template?.template_id;
            const schema = ingredient.schema || ingredient.attributes;
            const schemaName = schema?.schema_name;
            const collection = ingredient.collection;
            if (templateId) {
                filledIngredients.push({
                    ...ingredient,
                    template: {
                        ...ingredient.template,
                        ...(await templateFiller.fill(templateId))
                    },
                });
            } else if (schemaName) {
                const collectionName = schema?.collection_name;
                filledIngredients.push({
                    ...ingredient,
                    schema: (await schemaFiller.fill(collectionName, schemaName)),
                });
            } else if (collection) {
                const collectionName = collection.collection_name;
                filledIngredients.push({
                    ...ingredient,
                    collection: (await collectionFiller.fill(collectionName)),
                });
            } else {
                filledIngredients.push(ingredient);
            }
        }
        if (blend.rolls) {
            for (const roll of blend.rolls) {
                const filledOutcomes = [];
                for (const outcome of roll.outcomes) {
                    const filledResults = [];
                    for (const result of outcome.results) {
                        if (result.type === BlendResultType.ON_DEMAND_NFT_RESULT) {
                            const templateId = result.payload?.template_id;
                            if (templateId) {
                                filledResults.push({
                                    type: result.type,
                                    template: (await templateFiller.fill(templateId)),
                                });
                            }
                        } else if (result.type === BlendResultType.ON_DEMAND_NFT_RESULT_WITH_ATTRIBUTES) {
                            const templateId = result.payload?.template_id;
                            if (templateId) {
                                const mutable_data = result.payload?.mutable_data;
                                filledResults.push({
                                    type: result.type,
                                    template: {
                                        ...(await templateFiller.fill(templateId))
                                    },
                                    mutable_data,
                                });
                            }
                        } else if (result.type === BlendResultType.POOL_NFT_RESULT) {
                            filledResults.push({
                                type: result.type,
                                pool: result.payload,
                            });
                        } else if (result.type === BlendResultType.FT_RESULT) {
                            const [amountString, symbolCode] = result.payload.amount.quantity.split(' ');
                            const [digits, decimals] = amountString.split('.');
                            filledResults.push({
                                type: result.type,
                                token: {
                                    'token_contract': result.payload.amount.contract,
                                    'token_symbol': symbolCode,
                                    'token_precision': decimals?.length || 0,
                                    'amount': digits + (decimals || '')
                                },
                            });
                        }
                    }
                    filledOutcomes.push({
                        ...outcome,
                        results: filledResults,
                    });
                }
                filledRolls.push({
                    ...roll,
                    outcomes: filledOutcomes,
                });
            }
        }
        filledBlends.push({
            ...blend,
            ingredients: filledIngredients,
            rolls: filledRolls,
        });
    }

    return filledBlends;
}

export async function fillClaims(db: DB, assetContract: string, claims: any[]): Promise<any[]> {
    const templateIds: string[] = [];
    const assetIds: any[] = [];
    for (let i = 0; i < claims.length; i++) {
        const claim = claims[i];
        for (let j = 0; j < claim.results.length; j++) {
            const result = claim.results[j];
            const [claimType, value] = result.claim;
            if (claimType === 'POOL_NFT_CLAIM') {
                assetIds.push(value.asset_id);
            } else if (claimType === 'ON_DEMAND_NFT_CLAIM') {
                templateIds.push(value.template_id);
            }
        }
        assetIds.push(...claim.transferred_assets);
        assetIds.push(...claim.own_assets);
    }

    const templateFiller = new TemplateFiller(db, assetContract, templateIds, formatTemplate, 'atomicassets_templates_master');
    const assetFiller = new AssetFiller(db, assetContract, assetIds, formatAsset, 'atomicassets_assets_master');
    const filledClaims = [];

    for (let i = 0; i < claims.length; i++) {
        const claim = claims[i];
        const filledResults = [];
        for (let j = 0; j < claim.results.length; j++) {
            const result = claim.results[j];
            const [claimType, value] = result.claim;
            if (claimType === 'POOL_NFT_CLAIM') {
                filledResults.push({
                    asset: (await assetFiller.fill([value.asset_id]))[0],
                });
            }
            if (claimType === 'ON_DEMAND_NFT_CLAIM') {
                templateIds.push(value.template_id);
                filledResults.push({
                    template: (await templateFiller.fill(value.template_id)),
                });
            }
            if (claimType === 'FT_CLAIM') {
                const [amountString, symbolCode] = value.amount.quantity.split(' ');
                const [digits, decimals] = amountString.split('.');
                filledResults.push({
                    token: {
                        'token_contract': value.amount.contract,
                        'token_symbol': symbolCode,
                        'token_precision': decimals?.length || 0,
                        'amount': digits + (decimals || '')
                    },
                });
            }
        }

        filledClaims.push({
            ...claim,
            results: filledResults,
            transferred_assets: (await assetFiller.fill(claim.transferred_assets)),
            own_assets: (await assetFiller.fill(claim.own_assets)),
        });
    }

    return filledClaims;
}
