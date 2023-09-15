import {OfferState} from '../../../filler/handlers/atomicassets';
import QueryBuilder from '../../builder';
import {filterQueryArgs, FiltersDefinition, FilterValues} from '../validation';

export function hasAssetFilter(values: FilterValues, blacklist: string[] = []): boolean {
    return Object.keys(values)
        .filter(key => !blacklist.includes(key))
        .some(key => assetFilters[key]);
}

export function hasDataFilters(values: FilterValues): boolean {
    const keys = Object.keys(values);

    for (const key of keys) {
        if (['match', 'match_immutable_name', 'match_mutable_name', 'search'].includes(key)) {
            return true;
        }

        if (key.startsWith('data.') || key.startsWith('data:')) {
            return true;
        }

        if (key.startsWith('template_data.') || key.startsWith('template_data:')) {
            return true;
        }

        if (key.startsWith('immutable_data.') || key.startsWith('immutable_data:')) {
            return true;
        }

        if (key.startsWith('mutable_data.') || key.startsWith('mutable_data:')) {
            return true;
        }
    }

    return false;
}

export function buildDataConditions(values: FilterValues, query: QueryBuilder, options: { assetTable?: string, templateTable?: string }): void {
    const keys = Object.keys(values);

    function buildConditionObject(name: string): { [key: string]: string | number | boolean } {
        const searchObject: { [key: string]: string | number } = {};

        for (const key of keys) {
            if (key.startsWith(name + ':text.')) {
                searchObject[key.substr((name + ':text.').length)] = String(values[key]);
            } else if (key.startsWith(name + ':number.')) {
                searchObject[key.substr((name + ':number.').length)] = parseFloat(values[key]);
            } else if (key.startsWith(name + ':bool.')) {
                searchObject[key.substr((name + ':bool.').length)] = (values[key] === 'true' || values[key] === '1') ? 1 : 0;
            } else if (key.startsWith(name + '.')) {
                searchObject[key.substr((name + '.').length)] = values[key];
            }
        }

        return searchObject;
    }

    const templateCondition = {...buildConditionObject('data'), ...buildConditionObject('template_data')};
    const mutableCondition = buildConditionObject('mutable_data');
    const immutableCondition = buildConditionObject('immutable_data');

    if (!options.templateTable) {
        Object.assign(immutableCondition, buildConditionObject('data'), immutableCondition);
    }

    if (options.assetTable) {
        const assetDataCondition = {
            ...mutableCondition,
            ...immutableCondition,
        };

        if (Object.keys(assetDataCondition).length > 0) {
            // use combined index
            query.addCondition(`(${options.assetTable}.mutable_data || ${options.assetTable}.immutable_data) @> ${query.addVariable(JSON.stringify(mutableCondition))}::jsonb`);
            query.addCondition(`(${options.assetTable}.mutable_data || ${options.assetTable}.immutable_data) != '{}'`);
        }

        if (Object.keys(mutableCondition).length > 0) {
            query.addCondition(options.assetTable + '.mutable_data @> ' + query.addVariable(JSON.stringify(mutableCondition)) + '::jsonb');
        }

        if (Object.keys(immutableCondition).length > 0) {
            query.addCondition(options.assetTable + '.immutable_data @> ' + query.addVariable(JSON.stringify(immutableCondition)) + '::jsonb');
        }

        if (typeof values.match_immutable_name === 'string' && values.match_immutable_name.length > 0) {
            query.addCondition(
                options.assetTable + '.immutable_data->>\'name\' ILIKE ' +
                query.addVariable('%' + query.escapeLikeVariable(values.match_immutable_name) + '%')
            );
        }

        if (typeof values.match_mutable_name === 'string' && values.match_mutable_name.length > 0) {
            query.addCondition(
                options.assetTable + '.mutable_data->>\'name\' ILIKE ' +
                query.addVariable('%' + query.escapeLikeVariable(values.match_mutable_name) + '%')
            );
        }
    }

    if (options.templateTable) {
        if (Object.keys(templateCondition).length > 0) {
            query.addCondition(options.templateTable + '.immutable_data @> ' + query.addVariable(JSON.stringify(templateCondition)) + '::jsonb');
        }

        if (typeof values.match === 'string' && values.match.length > 0) {
            query.addCondition(
                options.templateTable + '.immutable_data->>\'name\' ILIKE ' +
                query.addVariable('%' + query.escapeLikeVariable(values.match) + '%')
            );
        }

        if (typeof values.search === 'string' && values.search.length > 0) {
            query.addCondition(
                `${query.addVariable(values.search)} <% (${options.templateTable}.immutable_data->>'name')`
            );
        }
    }
}

const assetFilters: FiltersDefinition = {
    asset_id: {type: 'id[]'},
    owner: {type: 'string', min: 1},
    burned: {type: 'bool'},
    template_id: {type: 'id[]'},
    collection_name: {type: 'string', min: 1},
    schema_name: {type: 'string', min: 1},
    is_transferable: {type: 'bool'},
    is_burnable: {type: 'bool'},
    minter: {type: 'name[]'},
    initial_receiver: {type: 'name[]'},
    burner: {type: 'name[]'},
};

export function buildAssetFilter(
    values: FilterValues, query: QueryBuilder,
    options: { assetTable?: string, templateTable?: string, allowDataFilter?: boolean } = {}
): void {
    options = {allowDataFilter: true, ...options};

    const args = filterQueryArgs(values, assetFilters);

    if (options.allowDataFilter !== false) {
        buildDataConditions(values, query, {assetTable: options.assetTable, templateTable: options.templateTable});
    }

    if (args.asset_id.length) {
        query.equalMany(options.assetTable + '.asset_id', args.asset_id);
    }

    if (args.owner) {
        query.equalMany(options.assetTable + '.owner', args.owner.split(','));
    }

    if (args.template_id.length) {
        if ((args.template_id.length === 1) && (args.template_id[0] === 'null')) {
            query.isNull(options.assetTable + '.template_id');
        } else {
            query.equalMany(options.assetTable + '.template_id', args.template_id);
        }
    }

    if (args.collection_name) {
        query.equalMany(options.assetTable + '.collection_name', args.collection_name.split(','));
    }

    if (args.schema_name) {
        query.equalMany(options.assetTable + '.schema_name', args.schema_name.split(','));
    }

    if (args.minter && args.minter.length > 0) {
        query.addCondition(`EXISTS (
            SELECT * FROM atomicassets_mints mint_table 
            WHERE ${options.assetTable}.contract = mint_table.contract AND ${options.assetTable}.asset_id = mint_table.asset_id
                AND mint_table.minter = ANY(${query.addVariable(args.minter)})
        )`);
    }

    if (args.initial_receiver && args.initial_receiver.length > 0) {
        query.addCondition(`EXISTS (
            SELECT * FROM atomicassets_mints mint_table 
            WHERE ${options.assetTable}.contract = mint_table.contract AND ${options.assetTable}.asset_id = mint_table.asset_id
                AND mint_table.receiver = ANY(${query.addVariable(args.initial_receiver)})
        )`);
    }

    if (args.burner && args.burner.length > 0) {
        query.equalMany(options.assetTable + '.burned_by_account', args.burner);
    }

    if (typeof args.burned === 'boolean') {
        if (args.burned) {
            query.isNull(options.assetTable + '.owner');
        } else {
            query.notNull(options.assetTable + '.owner');
        }
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
}

export function buildGreylistFilter(values: FilterValues, query: QueryBuilder, columns: { collectionName?: string, account?: string[] }): void {
    const args = filterQueryArgs(values, {
        collection_blacklist: {type: 'string', min: 1},
        collection_whitelist: {type: 'string', min: 1},
        account_blacklist: {type: 'string', min: 1},
        only_whitelisted: {type: 'bool'},
        exclude_blacklisted: {type: 'bool'},
        exclude_nsfw: {type: 'bool'},
        exclude_ai: {type: 'bool'},
    });

    let collectionBlacklist: string[] = [];
    let collectionWhitelist: string[] = [];

    if (args.collection_blacklist) {
        collectionBlacklist = args.collection_blacklist.split(',');
    }

    if (args.collection_whitelist) {
        collectionWhitelist = args.collection_whitelist.split(',');
    }

    if (typeof args.only_whitelisted === 'boolean') {
        if (args.only_whitelisted) {
            query.addCondition(columns.collectionName + ' IN (' +
                'SELECT DISTINCT(collection_name) ' +
                'FROM helpers_collection_list ' +
                'WHERE list = \'whitelist\' OR list = \'verified\' OR list = \'exceptions\')'
            );
            query.addCondition(columns.collectionName + ' NOT IN (' +
                'SELECT DISTINCT(collection_name) ' +
                'FROM helpers_collection_list ' +
                'WHERE list = \'blacklist\' OR list = \'scam\')'
            );
        }
    } else if (typeof args.exclude_blacklisted === 'boolean') {
        if (args.exclude_blacklisted) {
            query.addCondition(columns.collectionName + ' NOT IN (' +
                'SELECT DISTINCT(collection_name) ' +
                'FROM helpers_collection_list ' +
                'WHERE list = \'blacklist\' OR list = \'scam\')'
            );
        }
    }

    if (typeof args.exclude_nsfw === 'boolean') {
        if (args.exclude_nsfw) {
            query.addCondition(columns.collectionName + ' NOT IN (' +
                'SELECT DISTINCT(collection_name) ' +
                'FROM helpers_collection_list ' +
                'WHERE list = \'nsfw\')'
            );
        }
    }

    if (typeof args.exclude_ai === 'boolean') {
        if (args.exclude_ai) {
            query.addCondition(columns.collectionName + ' NOT IN (' +
                'SELECT DISTINCT(collection_name) ' +
                'FROM helpers_collection_list ' +
                'WHERE list = \'ai\')'
            );
        }
    }

    if (columns.collectionName) {
        if (collectionWhitelist.length > 0 && collectionBlacklist.length > 0) {
            query.equalMany(columns.collectionName, collectionWhitelist.filter(row => !collectionBlacklist.includes(row)));
        } else {
            if (collectionWhitelist.length > 0) {
                query.equalMany(columns.collectionName, collectionWhitelist);
            }

            if (collectionBlacklist.length > 0) {
                query.notMany(columns.collectionName, collectionBlacklist);
            }
        }
    }

    if (columns.account?.length > 0 && args.account_blacklist) {
        const accounts = args.account_blacklist.split(',');

        if (accounts.length > 0) {
            query.addCondition(
                'AND NOT EXISTS (SELECT * FROM UNNEST(' + query.addVariable(accounts) + '::text[]) ' +
                'WHERE ' + columns.account.map(column => ('"unnest" = ' + column)).join(' OR ') + ') '
            );
        }
    }
}

export function buildHideOffersFilter(values: FilterValues, query: QueryBuilder, assetTable: string): void {
    const args = filterQueryArgs(values, {
        hide_offers: {type: 'bool', default: false}
    });

    if (args.hide_offers) {
        query.addCondition(
            'NOT EXISTS (' +
            'SELECT * FROM atomicassets_offers offer, atomicassets_offers_assets offer_asset ' +
            'WHERE offer_asset.contract = ' + assetTable + '.contract AND offer_asset.asset_id = ' + assetTable + '.asset_id AND ' +
            'offer.contract = offer_asset.contract AND offer.offer_id = offer_asset.offer_id AND ' +
            'offer.state = ' + OfferState.PENDING + ' ' +
            ')'
        );
    }
}
