import {DB} from '../../server';
import {FillerHook} from '../atomicassets/filler';
import {formatTemplate, formatSchema, formatCollection} from '../atomicassets/format';
import {BlendResultType} from '../../../filler/handlers/blends';

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

export async function fillBlends(db: DB, assetContract: string, blends: any[]): Promise<any[]> {
    const templateIds: string[] = [];
    const schemaIds: any[] = [];
    const collectionNames: any[] = [];
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
    }

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
                    template: (await templateFiller.fill(templateId)),
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
