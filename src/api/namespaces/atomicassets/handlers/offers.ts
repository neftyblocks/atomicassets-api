import { buildBoundaryFilter, RequestValues } from '../../utils';
import { AtomicAssetsContext } from '../index';
import QueryBuilder from '../../../builder';
import { buildAssetFilter, hasAssetFilter } from '../utils';
import { applyActionGreylistFilters, getContractActionLogs } from '../../../utils';
import { filterQueryArgs } from '../../validation';

export async function getRawOffersAction(params: RequestValues, ctx: AtomicAssetsContext): Promise<any> {
    const maxLimit = ctx.coreArgs.limits?.offers || 100;
    const args = await filterQueryArgs(params, {
        page: {type: 'int', min: 1, default: 1},
        limit: {type: 'int', min: 1, max: maxLimit, default: Math.min(maxLimit, 100)},
        sort: {type: 'string', allowedValues: ['created', 'updated'], default: 'created'},
        order: {type: 'string', allowedValues: ['asc', 'desc'], default: 'desc'},

        account: {type: 'list[name]'},
        sender: {type: 'list[name]'},
        recipient: {type: 'list[name]'},
        state: {type: 'string', min: 1},
        memo: {type: 'string', min: 1},
        match_memo: {type: 'string', min: 1},

        asset_id: {type: 'list[id]'},

        recipient_asset_blacklist: {type: 'list[name]'},
        recipient_asset_whitelist: {type: 'list[name]'},
        sender_asset_blacklist: {type: 'list[name]'},
        sender_asset_whitelist: {type: 'list[name]'},
        account_whitelist: {type: 'list[name]'},
        account_blacklist: {type: 'list[name]'},
        collection_blacklist: {type: 'list[name]'},
        collection_whitelist: {type: 'list[name]'},
        only_whitelisted: {type: 'bool'},
        exclude_blacklisted: {type: 'bool'},
        exclude_nsfw: {type: 'bool'},
        exclude_ai: {type: 'bool'},

        is_recipient_contract: {type: 'bool'},

        hide_contracts: {type: 'bool'},
        hide_empty_offers: {type: 'bool'},

        count: {type: 'bool'}
    });

    const query = new QueryBuilder('SELECT contract, offer_id FROM atomicassets_offers offer');

    query.equal('contract', ctx.coreArgs.atomicassets_account);

    if (args.account.length) {
        const varName = query.addVariable(args.account);
        query.addCondition('(sender = ANY (' + varName + ') OR recipient = ANY (' + varName + '))');
    }

    if (args.sender.length) {
        query.equalMany('sender', args.sender);
    }

    if (args.recipient.length) {
        query.equalMany('recipient', args.recipient);
    }

    if (args.state) {
        query.equalMany('state', args.state.split(','));
    }

    if (args.memo) {
        query.equal('memo', args.memo);
    }

    if (args.match_memo) {
        query.addCondition(
            'memo ILIKE ' + query.addVariable('%' + query.escapeLikeVariable(args.match_memo) + '%')
        );
    }

    if (args.is_recipient_contract === true) {
        query.addCondition('EXISTS(SELECT * FROM contract_codes WHERE account = offer.recipient)');
    } else if (args.is_recipient_contract === false) {
        query.addCondition('NOT EXISTS(SELECT * FROM contract_codes WHERE account = offer.recipient)');
    }

    if (args.hide_contracts) {
        query.addCondition(
            'NOT EXISTS(SELECT * FROM contract_codes ' +
            'WHERE (account = offer.recipient OR account = offer.sender) AND NOT (account = ANY(' +
            query.addVariable([...args.account, ...args.sender, ...args.recipient]) +
            ')))'
        );
    }

    if (args.hide_empty_offers) {
        query.addCondition(
            'EXISTS(SELECT * FROM atomicassets_offers_assets asset ' +
            'WHERE asset.contract = offer.contract AND asset.offer_id = offer.offer_id AND asset.owner = offer.sender)'
        );

        query.addCondition(
            'EXISTS(SELECT * FROM atomicassets_offers_assets asset ' +
            'WHERE asset.contract = offer.contract AND asset.offer_id = offer.offer_id AND asset.owner = offer.recipient)'
        );
    }

    if (hasAssetFilter(params, ['asset_id'])) {
        const assetQuery = new QueryBuilder('SELECT * FROM atomicassets_offers_assets offer_asset, atomicassets_assets asset', query.buildValues());

        assetQuery.join('asset', 'offer_asset', ['contract', 'asset_id']);
        assetQuery.join('offer_asset', 'offer', ['contract', 'offer_id']);

        await buildAssetFilter(params, assetQuery, {assetTable: '"asset"', allowDataFilter: false});

        query.addCondition('EXISTS(' + assetQuery.buildString() + ')');
        query.setVars(assetQuery.buildValues());
    }

    if (args.asset_id.length) {
        query.addCondition(
            'EXISTS(' +
            'SELECT * FROM atomicassets_offers_assets asset ' +
            'WHERE offer.contract = asset.contract AND offer.offer_id = asset.offer_id AND ' +
            'asset_id = ANY (' + query.addVariable(args.asset_id) + ')' +
            ')'
        );
    }

    if (args.collection_blacklist.length) {
        query.addCondition(
            'NOT EXISTS(' +
            'SELECT * FROM atomicassets_offers_assets offer_asset, atomicassets_assets asset ' +
            'WHERE offer_asset.contract = offer.contract AND offer_asset.offer_id = offer.offer_id AND ' +
            'offer_asset.contract = asset.contract AND offer_asset.asset_id = asset.asset_id AND ' +
            'asset.collection_name = ANY (' + query.addVariable(args.collection_blacklist) + ')' +
            ')'
        );
    }

    if (args.collection_whitelist.length) {
        query.addCondition(
            'NOT EXISTS(' +
            'SELECT * FROM atomicassets_offers_assets offer_asset, atomicassets_assets asset ' +
            'WHERE offer_asset.contract = offer.contract AND offer_asset.offer_id = offer.offer_id AND ' +
            'offer_asset.contract = asset.contract AND offer_asset.asset_id = asset.asset_id AND ' +
            'NOT (asset.collection_name = ANY (' + query.addVariable(args.collection_whitelist) + '))' +
            ')'
        );
    }

    if (typeof args.only_whitelisted === 'boolean') {
        if (args.only_whitelisted) {
            query.addCondition(
                'NOT EXISTS(' +
                'SELECT * FROM atomicassets_offers_assets offer_asset, atomicassets_assets asset ' +
                'WHERE offer_asset.contract = offer.contract AND offer_asset.offer_id = offer.offer_id AND ' +
                'offer_asset.contract = asset.contract AND offer_asset.asset_id = asset.asset_id AND ' +
                'NOT (asset.collection_name = ANY (' +
                'SELECT DISTINCT(collection_name) ' +
                'FROM helpers_collection_list ' +
                'WHERE (list = \'whitelist\' OR list = \'verified\')' +
                ')'
            );
            query.addCondition(
                'NOT EXISTS(' +
                'SELECT * FROM atomicassets_offers_assets offer_asset, atomicassets_assets asset ' +
                'WHERE offer_asset.contract = offer.contract AND offer_asset.offer_id = offer.offer_id AND ' +
                'offer_asset.contract = asset.contract AND offer_asset.asset_id = asset.asset_id AND ' +
                '(asset.collection_name = ANY (' +
                'SELECT DISTINCT(collection_name) ' +
                'FROM helpers_collection_list ' +
                'WHERE (list = \'blacklist\' OR list = \'scam\')' +
                ')'
            );
        }
    } else if (typeof args.exclude_blacklisted === 'boolean') {
        if (args.exclude_blacklisted) {
            query.addCondition(
                'NOT EXISTS(' +
                'SELECT * FROM atomicassets_offers_assets offer_asset, atomicassets_assets asset ' +
                'WHERE offer_asset.contract = offer.contract AND offer_asset.offer_id = offer.offer_id AND ' +
                'offer_asset.contract = asset.contract AND offer_asset.asset_id = asset.asset_id AND ' +
                '(asset.collection_name = ANY (' +
                'SELECT DISTINCT(collection_name) ' +
                'FROM helpers_collection_list ' +
                'WHERE (list = \'blacklist\' OR list = \'scam\')' +
                ')'
            );
        }
    }

    if (typeof args.exclude_nsfw === 'boolean') {
        if (args.exclude_nsfw) {
            query.addCondition(
                'NOT EXISTS(' +
                'SELECT * FROM atomicassets_offers_assets offer_asset, atomicassets_assets asset ' +
                'WHERE offer_asset.contract = offer.contract AND offer_asset.offer_id = offer.offer_id AND ' +
                'offer_asset.contract = asset.contract AND offer_asset.asset_id = asset.asset_id AND ' +
                '(asset.collection_name = ANY (' +
                'SELECT DISTINCT(collection_name) ' +
                'FROM helpers_collection_list ' +
                'WHERE (list = \'nsfw\')' +
                ')'
            );
        }
    }

    if (typeof args.exclude_ai === 'boolean') {
        if (args.exclude_ai) {
            query.addCondition(
                'NOT EXISTS(' +
                'SELECT * FROM atomicassets_offers_assets offer_asset, atomicassets_assets asset ' +
                'WHERE offer_asset.contract = offer.contract AND offer_asset.offer_id = offer.offer_id AND ' +
                'offer_asset.contract = asset.contract AND offer_asset.asset_id = asset.asset_id AND ' +
                '(asset.collection_name = ANY (' +
                'SELECT DISTINCT(collection_name) ' +
                'FROM helpers_collection_list ' +
                'WHERE (list = \'ai\')' +
                ')'
            );
        }
    }

    if (args.account_blacklist.length) {
        const varName = query.addVariable(args.account_blacklist);
        query.addCondition('NOT (offer.sender = ANY(' + varName + ') OR offer.recipient = ANY(' + varName + '))');
    }

    if (args.account_whitelist.length) {
        const varName = query.addVariable(args.account_whitelist);
        query.addCondition('(offer.sender = ANY(' + varName + ') OR offer.recipient = ANY(' + varName + '))');
    }

    if (args.recipient_asset_blacklist.length) {
        query.addCondition(
            'NOT EXISTS(' +
            'SELECT * FROM atomicassets_offers_assets offer_asset ' +
            'WHERE offer_asset.contract = offer.contract AND offer_asset.offer_id = offer.offer_id AND ' +
            'offer_asset.owner = offer.recipient AND offer_asset.asset_id = ANY (' + query.addVariable(args.recipient_asset_blacklist) + ')' +
            ')'
        );
    }

    if (args.recipient_asset_whitelist.length) {
        query.addCondition(
            'NOT EXISTS(' +
            'SELECT * FROM atomicassets_offers_assets offer_asset ' +
            'WHERE offer_asset.contract = offer.contract AND offer_asset.offer_id = offer.offer_id AND ' +
            'offer_asset.owner = offer.recipient AND NOT (offer_asset.asset_id = ANY (' + query.addVariable(args.recipient_asset_whitelist) + '))' +
            ')'
        );
    }

    if (args.sender_asset_blacklist.length) {
        query.addCondition(
            'NOT EXISTS(' +
            'SELECT * FROM atomicassets_offers_assets offer_asset ' +
            'WHERE offer_asset.contract = offer.contract AND offer_asset.offer_id = offer.offer_id AND ' +
            'offer_asset.owner = offer.sender AND offer_asset.asset_id = ANY (' + query.addVariable(args.sender_asset_blacklist) + ')' +
            ')'
        );
    }

    if (args.sender_asset_whitelist.length) {
        query.addCondition(
            'NOT EXISTS(' +
            'SELECT * FROM atomicassets_offers_assets offer_asset ' +
            'WHERE offer_asset.contract = offer.contract AND offer_asset.offer_id = offer.offer_id AND ' +
            'offer_asset.owner = offer.sender AND NOT (offer_asset.asset_id = ANY (' + query.addVariable(args.sender_asset_whitelist) + '))' +
            ')'
        );
    }

    await buildBoundaryFilter(
        params, query, 'offer_id', 'int',
        args.sort === 'updated' ? 'updated_at_time' : 'created_at_time'
    );

    const sortColumnMapping: {[key: string]: string} = {
        created: 'created_at_time',
        updated: 'updated_at_time'
    };

    if (args.count) {
        const countQuery = await ctx.db.query(
            'SELECT COUNT(*) counter FROM (' + query.buildString() + ') x',
            query.buildValues()
        );

        return countQuery.rows[0].counter;
    }

    query.append('ORDER BY ' + sortColumnMapping[args.sort] + ' ' + args.order + ', offer_id ASC');
    query.paginate(args.page, args.limit);

    return await ctx.db.query(query.buildString(), query.buildValues());
}

export async function getOffersCountAction(params: RequestValues, ctx: AtomicAssetsContext): Promise<any> {
    return getRawOffersAction({...params, count: 'true'}, ctx);
}

export async function getOfferLogsCountAction(params: RequestValues, ctx: AtomicAssetsContext): Promise<any> {
    const maxLimit = ctx.coreArgs.limits?.logs || 100;
    const args = await filterQueryArgs({...ctx.pathParams, ...params}, {
        offer_id: {type: 'id'},
        page: {type: 'int', min: 1, default: 1},
        limit: {type: 'int', min: 1, max: maxLimit, default: Math.min(maxLimit, 100)},
        order: {type: 'string', allowedValues: ['asc', 'desc'], default: 'asc'},
        action_whitelist: {type: 'string[]', min: 1},
        action_blacklist: {type: 'string[]', min: 1},
    });

    return await getContractActionLogs(
        ctx.db, ctx.coreArgs.atomicassets_account,
        applyActionGreylistFilters(['lognewoffer', 'acceptoffer', 'declineoffer', 'canceloffer'], args),
        {offer_id: args.offer_id},
        (args.page - 1) * args.limit, args.limit, args.order
    );
}
