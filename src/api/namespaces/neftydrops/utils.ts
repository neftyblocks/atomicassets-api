import {
    buildDataConditions,
    hasDataFilters
} from '../atomicassets/utils';
import QueryBuilder from '../../builder';
import {DropApiState} from './index';
import {filterQueryArgs, FilterValues} from '../validation';

export function hasTemplateFilter(values: FilterValues, blacklist: string[] = []): boolean {
    const keys = Object.keys(values);

    for (const key of keys) {
        if (
            ['template_id', 'schema_name', 'is_transferable', 'is_burnable', 'is_locked'].indexOf(key) >= 0 &&
            blacklist.indexOf(key) === -1
        ) {
            return true;
        }
    }

    return false;
}

export async function buildTemplateFilter(
    values: FilterValues, query: QueryBuilder,
    options: {templateTable?: string, allowDataFilter?: boolean} = {}
): Promise<void> {
    options = Object.assign({allowDataFilter: true}, options);

    const args = await filterQueryArgs(values, {
        template_id: {type: 'string', min: 1},
        schema_name: {type: 'string', min: 1},
        is_transferable: {type: 'bool'},
        is_burnable: {type: 'bool'},
        is_locked: { type: 'bool'},
    });

    if (options.allowDataFilter !== false) {
        buildDataConditions(values, query, {assetTable: null, templateTable: options.templateTable});
    }

    if (args.template_id) {
        query.equalMany(options.templateTable + '.template_id', args.template_id.split(','));
    }

    if (args.schema_name) {
        query.equalMany(options.templateTable + '.schema_name', args.schema_name.split(','));
    }

    if (options.templateTable && typeof args.is_transferable === 'boolean') {
        if (args.is_transferable) {
            query.addCondition(options.templateTable + '.transferable IS DISTINCT FROM FALSE');
        } else {
            query.addCondition(options.templateTable + '.transferable = FALSE');
        }
    }

    if (options.templateTable && typeof args.is_burnable === 'boolean') {
        if (args.is_burnable) {
            query.addCondition(options.templateTable + '.burnable IS DISTINCT FROM FALSE');
        } else {
            query.addCondition(options.templateTable + '.burnable = FALSE');
        }
    }

    if (options.templateTable && typeof args.is_locked === 'boolean') {
        if (args.is_locked) {
            query.addCondition('("drop_asset".use_pool = FALSE AND '+options.templateTable + '.max_supply > 0 AND ' + options.templateTable + '.max_supply = ' + options.templateTable + '.issued_supply)');
        } else {
            query.addCondition('("drop_asset".use_pool = TRUE OR ('+options.templateTable + '.max_supply = 0 OR ' + options.templateTable + '.max_supply > ' + options.templateTable + '.issued_supply))');
        }
    }
}

export async function buildListingFilter(values: FilterValues, query: QueryBuilder): Promise<void> {
    const args = await filterQueryArgs(values, {
        collection_name: {type: 'string', min: 1},
    });

    if (args.collection_name) {
        query.equalMany('ndrop.collection_name', args.collection_name.split(','));
    }
}

export async function buildDropFilter(values: FilterValues, query: QueryBuilder): Promise<void> {
    const args = await filterQueryArgs(values, {
        state: {type: 'string', min: 0},
        hidden: {type: 'bool', default: false},
        secure: {type: 'bool'},
        has_referrals_enabled: {type: 'bool'},

        max_assets: {type: 'int', min: 1},
        min_assets: {type: 'int', min: 1},

        symbol: {type: 'string', min: 1},
        min_price: {type: 'float', min: 0},
        max_price: {type: 'float', min: 0},

        collection_name: {type: 'string', min: 1},
    });

    await buildListingFilter(values, query);

    if (args.max_assets) {
        query.addCondition(
            `(
                SELECT COUNT(*) FROM (
                    SELECT FROM neftydrops_drop_assets asset
                    WHERE asset.assets_contract = ndrop.assets_contract AND asset.drop_id = ndrop.drop_id LIMIT ${args.max_assets + 1}
                ) ct        
            ) <= ${args.max_assets} `
        );
    }

    if (args.min_assets) {
        query.addCondition(
            `(
                SELECT COUNT(*) FROM (
                    SELECT FROM neftydrops_drop_assets asset
                    WHERE asset.assets_contract = ndrop.assets_contract AND asset.drop_id = ndrop.drop_id LIMIT ${args.min_assets}
                ) ct        
            ) >= ${args.min_assets} `
        );
    }

    if (args.symbol) {
        query.equal('ndrop.settlement_symbol', args.symbol);

        if (args.min_price) {
            query.addCondition('price.price > 0 AND price.price >= 1.0 * ' + query.addVariable(args.min_price) + ' * POWER(10, price.settlement_precision)');
        }

        if (args.max_price) {
            query.addCondition('price.price <= 1.0 * ' + query.addVariable(args.max_price) + ' * POWER(10, price.settlement_precision)');
        }
    }

    if (args.collection_name) {
        query.equalMany('ndrop.collection_name', args.collection_name.split(','));
    }

    if (args.state) {
        const stateFilters: string[] = [];
        if (args.state.split(',').indexOf(String(DropApiState.ACTIVE.valueOf())) >= 0) {
            stateFilters.push('(ndrop.is_deleted = FALSE AND (ndrop.end_time = 0::BIGINT OR ndrop.end_time > ' + new Date().getTime() +'::BIGINT))');
        }
        if (args.state.split(',').indexOf(String(DropApiState.DELETED.valueOf())) >= 0) {
            stateFilters.push('ndrop.is_deleted = TRUE');
        }
        if (args.state.split(',').indexOf(String(DropApiState.SOLD_OUT.valueOf())) >= 0) {
            stateFilters.push('(ndrop.is_deleted = FALSE AND ndrop.max_claimable > 0 AND ndrop.max_claimable <= ndrop.current_claimed)');
        }
        if (args.state.split(',').indexOf(String(DropApiState.ENDED.valueOf())) >= 0) {
            stateFilters.push('(ndrop.is_deleted = FALSE AND ndrop.end_time > 0::BIGINT AND ndrop.end_time < ' + new Date().getTime() +'::BIGINT)');
        }
        if (args.state.split(',').indexOf(String(DropApiState.AVAILABLE.valueOf())) >= 0) {
            stateFilters.push('(ndrop.is_deleted = FALSE AND ndrop.is_available = TRUE AND (ndrop.end_time = 0::BIGINT OR ndrop.end_time > ' + new Date().getTime() +'::BIGINT))');
            values.is_locked = 'false';
        }
        query.addCondition('(' + stateFilters.join(' OR ') + ')');
    } else {
        query.addCondition('(ndrop.is_deleted = FALSE AND (ndrop.end_time = 0::BIGINT OR ndrop.end_time > ' + new Date().getTime() +'::BIGINT))');
    }

    if (!args.hidden) {
        query.equal('ndrop.is_hidden', false);
    }

    if (typeof args.secure === 'boolean') {
        query.equal('ndrop.auth_required', args.secure);
    }

    if (typeof args.has_referrals_enabled === 'boolean') {
        if (args.has_referrals_enabled) {
            query.addCondition('ndrop.referral_fee > 0');
        } else {
            query.addCondition('ndrop.referral_fee = 0');
        }
    }

    if (hasTemplateFilter(values) || hasDataFilters(values)) {
        const assetQuery = new QueryBuilder(
            'SELECT * FROM neftydrops_drop_assets drop_asset ' +
            'LEFT JOIN atomicassets_templates "template" ON (drop_asset.assets_contract = "template".contract AND drop_asset.template_id = "template".template_id)',
            query.buildValues()
        );

        assetQuery.addCondition('drop_asset.drop_id = ndrop.drop_id');
        await buildTemplateFilter(values, assetQuery, {templateTable: '"template"', allowDataFilter: true});

        query.addCondition('EXISTS(' + assetQuery.buildString() + ')');
        query.setVars(assetQuery.buildValues());
    }
}

export function buildRangeCondition(column: string, after?: number, before?: number): string {
    let queryStr = '';

    if (typeof after === 'number' && after > 0) {
        queryStr += 'AND ' + column + ' > ' + after + ' ';
    }

    if (typeof before === 'number' && before > 0) {
        queryStr += 'AND ' + column + ' < ' + before + ' ';
    }

    return queryStr;
}
