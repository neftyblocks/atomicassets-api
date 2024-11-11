import {DB} from '../../server';
import {AssetFiller, FillerHook} from '../atomicassets/filler';
import {formatTemplate, formatSchema, formatCollection, formatAsset} from '../atomicassets/format';
import {renderMarkdownToHtml} from '../utils';
import {UpgradeRequirementType} from '../../../filler/handlers/upgrades';

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

export async function fillUpgrades(db: DB, assetContract: string, upgrades: any[], renderMarkdown: boolean): Promise<any[]> {
    let templateIds: string[] = [];
    const schemaIds: any[] = [];
    let collectionNames: any[] = [];

    for (const upgrade of upgrades) {
        for (const ingredient of upgrade.ingredients) {
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
        if (upgrade.upgrade_specs) {
            for (const specs of upgrade.upgrade_specs) {
                for (const requirements of specs.upgrade_requirements) {
                    if (requirements.type === UpgradeRequirementType.TEMPLATE_REQUIREMENT) {
                        const templateId = requirements.payload?.template_id;
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
                displayData = JSON.parse(upgrade.display_data);
                if (displayData.description) {
                    displayData.description = renderMarkdownToHtml(displayData.description);
                }
            } catch (e) {
                // Ignore
            }
            upgrade.display_data = displayData;
        }
    }

    templateIds = [...new Set(templateIds)];
    collectionNames = [...new Set(collectionNames)];

    const templateFiller = new TemplateFiller(db, assetContract, templateIds, formatTemplate, 'atomicassets_templates_master');
    const schemaFiller = new SchemaFiller(db, assetContract, schemaIds, formatSchema, 'atomicassets_schemas');
    const collectionFiller = new CollectionFiller(db, assetContract, collectionNames, formatCollection, 'atomicassets_collections');
    const filledUpgrades = [];

    for (const upgrade of upgrades) {
        const filledIngredients = [];
        const filledSpecs: any[] = [];

        for (const ingredient of upgrade.ingredients) {
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
        if (upgrade.upgrade_specs) {
            for (const specs of upgrade.upgrade_specs) {
                const filledRequirements = [];
                for (const requirement of specs.upgrade_requirements) {
                    if (requirement.type === UpgradeRequirementType.TEMPLATE_REQUIREMENT) {
                        const templateId = requirement.payload?.template_id;
                        if (templateId) {
                            requirement.template = (await templateFiller.fill(templateId));
                        }
                        delete requirement.payload;
                    } else if (requirement.type === UpgradeRequirementType.TYPED_ATTRIBUTE_REQUIREMENT) {
                        requirement.typed_attribute_definition = requirement.payload?.typed_attribute_definition;
                        delete requirement.payload;
                    }

                    filledRequirements.push(requirement);
                }
                filledSpecs.push({
                    ...specs,
                    upgrade_requirements: filledRequirements,
                });
            }
        }
        filledUpgrades.push({
            ...upgrade,
            ingredients: filledIngredients,
            upgrade_specs: filledSpecs,
        });
    }

    return filledUpgrades;
}

export async function fillClaims(db: DB, assetContract: string, claims: any[]): Promise<any[]> {
    const assetIds: any[] = [];
    for (let i = 0; i < claims.length; i++) {
        const claim = claims[i];
        for (let j = 0; j < claim.mutations.length; j++) {
            const mutation = claim.mutations[j];
            assetIds.push(mutation.asset_id);
        }
        assetIds.push(...claim.transferred_assets);
        assetIds.push(...claim.own_assets);
    }

    const assetFiller = new AssetFiller(db, assetContract, assetIds, formatAsset, 'atomicassets_assets_master');
    const filledClaims = [];

    for (let i = 0; i < claims.length; i++) {
        const claim = claims[i];
        const filledMutations = [];
        for (let j = 0; j < claim.mutations.length; j++) {
            const mutation = claim.mutations[j];
            mutation.asset = (await assetFiller.fill([mutation.asset_id]))[0];
            filledMutations.push(mutation);
        }

        filledClaims.push({
            ...claim,
            mutations: filledMutations,
            transferred_assets: (await assetFiller.fill(claim.transferred_assets)),
            own_assets: (await assetFiller.fill(claim.own_assets)),
        });
    }

    return filledClaims;
}
