import {RequestValues, SortColumn, SortColumnMapping} from '../../utils';
import {NeftyUpgradesContext} from '../index';
import QueryBuilder from '../../../builder';
import {filterQueryArgs} from '../../validation';
import {
    UpgradeIngredientType,
    IngredientEffectType,
    UpgradeRequirementType, UpgradeRequirementComparator
} from '../../../../filler/handlers/upgrades';
import {hasAssetFilter, hasDataFilters} from '../../atomicassets/utils';
import {fillAssets} from '../../atomicassets/filler';
import {formatAsset} from '../../atomicassets/format';
import {BlendIngredientType} from '../../../../filler/handlers/blends';
export async function getUpgradeIngredientAssets(params: RequestValues, ctx: NeftyUpgradesContext): Promise<any> {
    const args = await filterQueryArgs(params, {
        page: {type: 'int', min: 1, default: 1},
        limit: {type: 'int', min: 1, max: 1000, default: 100},
        sort: {
            type: 'string',
            allowedValues: [
                'asset_id', 'updated',
                'transferred', 'minted',
                'template_mint', 'name',
                'balance_attribute'
            ],
            default: 'asset_id'
        },
        order: {type: 'string', allowedValues: ['asc', 'desc'], default: 'desc'},
        owner: {type: 'string', default: ''},
        has_backed_tokens: {type: 'bool'},
        count: {type: 'bool'}
    });

    const upgradeQuery = new QueryBuilder(`
        SELECT *  FROM neftyupgrades_upgrade_details_master upgrade_detail
    `);
    upgradeQuery.equal('upgrade_detail.upgrade_id', ctx.pathParams.upgrade_id);
    upgradeQuery.equal('upgrade_detail.contract', ctx.coreArgs.upgrades_account);

    const upgradeResult = await ctx.db.query(upgradeQuery.buildString(), upgradeQuery.buildValues());
    if (upgradeResult.rows.length < 1){
        return null;
    }

    const upgrade = upgradeResult.rows[0];
    const ingredient = upgrade.ingredients.find((i: any) => i.index === parseInt(ctx.pathParams.index, 10));
    if (!ingredient) {
        throw new Error('Invalid index');
    }

    const query = new QueryBuilder(
        'SELECT asset.asset_id FROM atomicassets_assets asset ' +
        'LEFT JOIN atomicassets_templates "template" ON (' +
        'asset.contract = template.contract AND asset.template_id = template.template_id' +
        ') '
    );

    let balanceNameVar;


    let requiresTransferable = true;
    const requiresBurnable = ingredient.effect.type === IngredientEffectType.TYPED_EFFECT && ingredient.effect.payload.type === 0;
    if (ingredient.type === UpgradeIngredientType.ATTRIBUTE_INGREDIENT) {
        const attributes = ingredient.attributes;
        query.equal('asset.collection_name', attributes.collection_name);
        query.equal('asset.schema_name', attributes.schema_name);

        for (const attribute of attributes.attributes) {
            const attributeNameVar = query.addVariable(attribute.name);
            const attributeValueVar = query.addVariable(attribute.allowed_values);
            query.addCondition('((' +
                '(asset.mutable_data->>'+attributeNameVar+' = ANY('+attributeValueVar+') OR asset.immutable_data->>'+attributeNameVar+' = ANY('+attributeValueVar+')) ' +
                'AND ' +
                '(asset.mutable_data || asset.immutable_data) != \'{}\' ' +
                ') ' +
                'OR ' +
                '"template".immutable_data->>'+attributeNameVar+' = ANY('+attributeValueVar+') ' +
                ')');
        }
    } else if (ingredient.type === UpgradeIngredientType.TYPED_ATTRIBUTE_INGREDIENT) {
        const attributes = ingredient.typed_attributes;
        query.equal('asset.collection_name', attributes.collection_name);
        query.equal('asset.schema_name', attributes.schema_name);

        for (const attribute of attributes.attributes) {
            const attributeNameVar = query.addVariable(attribute.attribute_name);
            const attributeValueVar = query.addVariable(attribute.allowed_values);
            query.addCondition('((' +
                '(asset.mutable_data->>'+attributeNameVar+' = ANY('+attributeValueVar+') OR asset.immutable_data->>'+attributeNameVar+' = ANY('+attributeValueVar+')) ' +
                'AND ' +
                '(asset.mutable_data || asset.immutable_data) != \'{}\' ' +
                ') ' +
                'OR ' +
                '"template".immutable_data->>'+attributeNameVar+' = ANY('+attributeValueVar+') ' +
                ')');
        }
    } else if (ingredient.type === UpgradeIngredientType.TEMPLATE_INGREDIENT) {
        query.equal('asset.template_id', ingredient.template.template_id);
    } else if (ingredient.type === UpgradeIngredientType.SCHEMA_INGREDIENT) {
        query.equal('asset.collection_name', ingredient.schema.collection_name);
        query.equal('asset.schema_name', ingredient.schema.schema_name);
    } else if (ingredient.type === UpgradeIngredientType.COLLECTION_INGREDIENT) {
        query.equal('asset.collection_name', ingredient.collection.collection_name);
    } else if (ingredient.type === UpgradeIngredientType.BALANCE_INGREDIENT) {
        balanceNameVar = query.addVariable(ingredient.template.attribute_name);
        const costVar = query.addVariable(ingredient.template.cost);
        query.equal('asset.template_id', ingredient.template.template_id);
        query.addCondition(`(asset.mutable_data->>${balanceNameVar})::BIGINT >= ${costVar}::BIGINT`);
        requiresTransferable = false;
    } else if (ingredient.type === UpgradeIngredientType.COOLDOWN_INGREDIENT) {
        const requirements = ingredient.template.requirements || [];
        balanceNameVar = query.addVariable(ingredient.template.attribute_name);
        query.equal('asset.template_id', ingredient.template.template_id);
        const conditions: Record<string, any> = {};
        for (const attribute of requirements) {
            const attributeNameVar = query.addVariable(attribute.name);
            const attributeValueVar = query.addVariable(attribute.allowed_values);
            query.addCondition('((' +
                '(asset.mutable_data->>'+attributeNameVar+' = ANY('+attributeValueVar+') OR asset.immutable_data->>'+attributeNameVar+' = ANY('+attributeValueVar+')) ' +
                'AND ' +
                '(asset.mutable_data || asset.immutable_data) != \'{}\' ' +
                ') ' +
                'OR ' +
                '"template".immutable_data->>'+attributeNameVar+' = ANY('+attributeValueVar+') ' +
                ')');
            conditions[attribute.name] = attribute.allowed_values;
        }

        requiresTransferable = false;
    }

    if (requiresTransferable) {
        query.addCondition('"template".transferable IS DISTINCT FROM FALSE');
    }

    if (requiresBurnable) {
        query.addCondition('"template".burnable IS DISTINCT FROM FALSE');
    }

    if (args.owner) {
        query.equalMany('asset.owner', args.owner.split(','));
    }

    if (typeof args.has_backed_tokens === 'boolean') {
        if (args.has_backed_tokens) {
            query.addCondition('EXISTS (' +
                'SELECT * FROM atomicassets_assets_backed_tokens token ' +
                'WHERE asset.contract = token.contract AND asset.asset_id = token.asset_id' +
                ')');
        } else {
            query.addCondition('NOT EXISTS (' +
                'SELECT * FROM atomicassets_assets_backed_tokens token ' +
                'WHERE asset.contract = token.contract AND asset.asset_id = token.asset_id' +
                ')');
        }
    }

    let sorting: SortColumn;

    if (args.sort) {
        const sortColumnMapping: SortColumnMapping = {
            asset_id: {column: 'asset.asset_id', nullable: false, numericIndex: true},
            updated: {column: 'asset.updated_at_time', nullable: false, numericIndex: true},
            transferred: {column: 'asset.transferred_at_time', nullable: false, numericIndex: true},
            minted: {column: 'asset.asset_id', nullable: false, numericIndex: true},
            template_mint: {column: 'asset.template_mint', nullable: true, numericIndex: true},
            name: {column: `(COALESCE(asset.mutable_data, '{}') || COALESCE(asset.immutable_data, '{}') || COALESCE(template.immutable_data, '{}'))->>'name'`, nullable: true, numericIndex: false},
        };

        if (balanceNameVar) {
            sortColumnMapping.balance_attribute = {column: `(asset.mutable_data->>${balanceNameVar})::BIGINT`, nullable: true, numericIndex: true};
        }

        sorting = sortColumnMapping[args.sort];
    }

    if (!sorting) {
        sorting = {column: 'asset.asset_id', nullable: false, numericIndex: true};
    }

    const ignoreIndex = hasAssetFilter(params) || hasDataFilters(params)  && sorting.numericIndex;

    query.append('ORDER BY ' + sorting.column + (ignoreIndex ? ' + 1 ' : ' ') + args.order + ' ' + (sorting.nullable ? 'NULLS LAST' : '') + ', asset.asset_id ASC');
    query.paginate(args.page, args.limit);

    const result = await ctx.db.query(query.buildString(), query.buildValues());
    const assetIds = result.rows.map((row: any) => row.asset_id);
    return await fillAssets(
        ctx.db,
        ctx.coreArgs.atomicassets_account,
        assetIds,
        formatAsset, 'atomicassets_assets_master'
    );
}

export async function getUpgradeableAssets(params: RequestValues, ctx: NeftyUpgradesContext): Promise<any> {
    const args = await filterQueryArgs(params, {
        page: {type: 'int', min: 1, default: 1},
        limit: {type: 'int', min: 1, max: 1000, default: 100},
        sort: {
            type: 'string',
            allowedValues: [
                'asset_id', 'updated',
                'transferred', 'minted',
                'template_mint', 'name',
            ],
            default: 'asset_id'
        },
        order: {type: 'string', allowedValues: ['asc', 'desc'], default: 'desc'},
        owner: {type: 'string', default: ''},
        has_backed_tokens: {type: 'bool'},
        count: {type: 'bool'}
    });

    const upgradeQuery = new QueryBuilder(`
        SELECT *  FROM neftyupgrades_upgrade_details_master upgrade_detail
    `);
    upgradeQuery.equal('upgrade_detail.upgrade_id', ctx.pathParams.upgrade_id);
    upgradeQuery.equal('upgrade_detail.contract', ctx.coreArgs.upgrades_account);

    const upgradeResult = await ctx.db.query(upgradeQuery.buildString(), upgradeQuery.buildValues());
    if (upgradeResult.rows.length < 1){
        return null;
    }

    const upgrade = upgradeResult.rows[0];
    const spec = upgrade.upgrade_specs.find((i: any) => i.index === parseInt(ctx.pathParams.index, 10));
    if (!spec) {
        throw new Error('Invalid index');
    }

    const query = new QueryBuilder(
        'SELECT asset.asset_id FROM atomicassets_assets asset ' +
        'LEFT JOIN atomicassets_templates "template" ON (' +
        'asset.contract = template.contract AND asset.template_id = template.template_id' +
        ') '
    );

    const schemaName = spec.schema_name;
    const requirements = spec.upgrade_requirements;

    for (const requirement of requirements) {
        if (requirement.type === UpgradeRequirementType.TEMPLATE_REQUIREMENT) {
            query.equal('asset.template_id', requirement.payload.template_id);
        } else if (requirement.type === UpgradeRequirementType.TYPED_ATTRIBUTE_REQUIREMENT) {
            query.equal('asset.collection_name', upgrade.collection_name);
            query.equal('asset.schema_name', schemaName);

            const attributeDefinition = requirement.payload.typed_attribute_definition;
            const attributeNameVar = query.addVariable(attributeDefinition.attribute_name);
            const allowedValues = attributeDefinition.allowed_values[1];
            const attributeValueVar = query.addVariable(allowedValues);

            if (attributeDefinition.comparator === UpgradeRequirementComparator.EQUALS) {
                query.addCondition('((' +
                    '(asset.mutable_data->>' + attributeNameVar + ' = ANY(' + attributeValueVar + ') OR asset.immutable_data->>' + attributeNameVar + ' = ANY(' + attributeValueVar + ')) ' +
                    'AND ' +
                    '(asset.mutable_data || asset.immutable_data) != \'{}\' ' +
                    ') ' +
                    'OR ' +
                    '"template".immutable_data->>' + attributeNameVar + ' = ANY(' + attributeValueVar + ') ' +
                    ')');
            } else {
                throw new Error('Unsupported comparator');
            }
        }
    }

    if (args.owner) {
        query.equalMany('asset.owner', args.owner.split(','));
    }

    if (typeof args.has_backed_tokens === 'boolean') {
        if (args.has_backed_tokens) {
            query.addCondition('EXISTS (' +
                'SELECT * FROM atomicassets_assets_backed_tokens token ' +
                'WHERE asset.contract = token.contract AND asset.asset_id = token.asset_id' +
                ')');
        } else {
            query.addCondition('NOT EXISTS (' +
                'SELECT * FROM atomicassets_assets_backed_tokens token ' +
                'WHERE asset.contract = token.contract AND asset.asset_id = token.asset_id' +
                ')');
        }
    }

    let sorting: SortColumn;

    if (args.sort) {
        const sortColumnMapping: SortColumnMapping = {
            asset_id: {column: 'asset.asset_id', nullable: false, numericIndex: true},
            updated: {column: 'asset.updated_at_time', nullable: false, numericIndex: true},
            transferred: {column: 'asset.transferred_at_time', nullable: false, numericIndex: true},
            minted: {column: 'asset.asset_id', nullable: false, numericIndex: true},
            template_mint: {column: 'asset.template_mint', nullable: true, numericIndex: true},
            name: {column: `(COALESCE(asset.mutable_data, '{}') || COALESCE(asset.immutable_data, '{}') || COALESCE(template.immutable_data, '{}'))->>'name'`, nullable: true, numericIndex: false},
        };
        sorting = sortColumnMapping[args.sort];
    }

    if (!sorting) {
        sorting = {column: 'asset.asset_id', nullable: false, numericIndex: true};
    }

    const ignoreIndex = hasAssetFilter(params) || hasDataFilters(params)  && sorting.numericIndex;

    query.append('ORDER BY ' + sorting.column + (ignoreIndex ? ' + 1 ' : ' ') + args.order + ' ' + (sorting.nullable ? 'NULLS LAST' : '') + ', asset.asset_id ASC');
    query.paginate(args.page, args.limit);

    const result = await ctx.db.query(query.buildString(), query.buildValues());
    const assetIds = result.rows.map((row: any) => row.asset_id);
    return await fillAssets(
        ctx.db,
        ctx.coreArgs.atomicassets_account,
        assetIds,
        formatAsset, 'atomicassets_assets_master'
    );
}
