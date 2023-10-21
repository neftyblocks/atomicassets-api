import {buildBoundaryFilter, RequestValues} from '../../utils';
import {NeftyMarketContext} from '../index';
import QueryBuilder from '../../../builder';
import {buildAuctionFilter, hasListingFilter} from '../utils';
import {buildGreylistFilter, hasAssetFilter, hasDataFilters} from '../../atomicassets/utils';
import {fillAuctions} from '../filler';
import {formatAuction} from '../format';
import {ApiError} from '../../../error';
import {applyActionGreylistFilters, getContractActionLogs} from '../../../utils';
import {filterQueryArgs} from '../../validation';

export async function getAuctionsAction(params: RequestValues, ctx: NeftyMarketContext): Promise<any> {
    const maxLimit = ctx.coreArgs.limits?.auctions || 100;
    const args = await filterQueryArgs(params, {
        page: {type: 'int', min: 1, default: 1},
        limit: {type: 'int', min: 1, max: maxLimit, default: Math.min(maxLimit, 100)},
        sort: {
            type: 'string',
            allowedValues: [
                'created', 'updated', 'starting', 'ending', 'auction_id', 'price',
                'buy_now_price', 'template_mint'
            ],
            default: 'created'
        },
        order: {type: 'string', allowedValues: ['asc', 'desc'], default: 'desc'},

        count: {type: 'bool'}
    });

    const query = new QueryBuilder(
        'SELECT listing.auction_id ' +
        'FROM neftymarket_auctions listing ' +
        'JOIN neftymarket_tokens "token" ON (listing.market_contract = "token".market_contract AND listing.token_symbol = "token".token_symbol)' +
        'LEFT JOIN neftymarket_auction_prices price ON (listing.market_contract = price.market_contract AND listing.auction_id = price.auction_id)'
    );

    query.equal('listing.market_contract', ctx.coreArgs.neftymarket_account);

    query.addCondition(
        'NOT EXISTS (' +
        'SELECT * FROM neftymarket_auctions_assets auction_asset ' +
        'WHERE auction_asset.market_contract = listing.market_contract AND auction_asset.auction_id = listing.auction_id AND ' +
        'NOT EXISTS (SELECT * FROM atomicassets_assets asset WHERE asset.contract = auction_asset.assets_contract AND asset.asset_id = auction_asset.asset_id)' +
        ')'
    );

    await buildAuctionFilter(params, query);
    await buildGreylistFilter(params, query, {collectionName: 'listing.collection_name'});

    let dateColumn;
    if (args.sort === 'starting') {
        dateColumn = 'listing.start_time';
    } else if (args.sort === 'ending') {
        dateColumn = 'listing.end_time';
    } else if (args.sort === 'updated') {
        dateColumn = 'listing.updated_at_time';
    } else {
        dateColumn = 'listing.created_at_time';
    }
    await buildBoundaryFilter(
        params, query, 'listing.auction_id', 'int', dateColumn
    );

    if (args.count) {
        const countQuery = await ctx.db.query(
            'SELECT COUNT(*) counter FROM (' + query.buildString() + ') x',
            query.buildValues()
        );

        return countQuery.rows[0].counter;
    }

    const sortMapping: { [key: string]: { column: string, nullable: boolean, numericIndex: boolean } } = {
        auction_id: {column: 'listing.auction_id', nullable: false, numericIndex: true},
        starting: {column: 'listing.start_time', nullable: false, numericIndex: true},
        ending: {column: 'listing.end_time', nullable: false, numericIndex: true},
        created: {column: 'listing.created_at_time', nullable: false, numericIndex: true},
        updated: {column: 'listing.updated_at_time', nullable: false, numericIndex: true},
        price: {column: 'listing.price', nullable: true, numericIndex: false},
        buy_now_price: {column: 'price.buy_now_price_dynamic', nullable: true, numericIndex: false},
        template_mint: {column: 'LOWER(listing.template_mint)', nullable: true, numericIndex: false}
    };

    const ignoreIndex = (hasAssetFilter(params) || hasDataFilters(params) || hasListingFilter(params)) && sortMapping[args.sort].numericIndex;

    query.append('ORDER BY ' + sortMapping[args.sort].column + (ignoreIndex ? ' + 1 ' : ' ') + args.order + ' ' + (sortMapping[args.sort].nullable ? 'NULLS LAST' : '') + ', listing.auction_id ASC');
    query.paginate(args.page, args.limit);

    const auctionResult = await ctx.db.query(query.buildString(), query.buildValues());

    const auctionLookup: { [key: string]: any } = {};
    const result = await ctx.db.query(
        'SELECT * FROM neftymarket_auctions_master WHERE market_contract = $1 AND auction_id = ANY ($2)',
        [ctx.coreArgs.neftymarket_account, auctionResult.rows.map(row => row.auction_id)]
    );

    result.rows.reduce((prev, current) => {
        prev[String(current.auction_id)] = current;

        return prev;
    }, auctionLookup);

    return await fillAuctions(
        ctx.db, ctx.coreArgs.atomicassets_account,
        auctionResult.rows.map((row) => formatAuction(auctionLookup[String(row.auction_id)]))
    );
}

export async function getAuctionsCountAction(params: RequestValues, ctx: NeftyMarketContext): Promise<any> {
    return getAuctionsAction({...params, count: 'true'}, ctx);
}

export async function getAuctionAction(params: RequestValues, ctx: NeftyMarketContext): Promise<any> {
    const query = await ctx.db.query(
        'SELECT * FROM neftymarket_auctions_master WHERE market_contract = $1 AND auction_id = $2',
        [ctx.coreArgs.neftymarket_account, ctx.pathParams.auction_id]
    );

    if (query.rowCount === 0) {
        throw new ApiError('Auction not found', 416);
    }
    const auctions = await fillAuctions(
        ctx.db, ctx.coreArgs.atomicassets_account, query.rows.map(formatAuction)
    );

    return auctions[0];
}

export async function getAuctionLogsAction(params: RequestValues, ctx: NeftyMarketContext): Promise<any> {
    const maxLimit = ctx.coreArgs.limits?.logs || 100;
    const args = await filterQueryArgs(params, {
        page: {type: 'int', min: 1, default: 1},
        limit: {type: 'int', min: 1, max: maxLimit, default: Math.min(maxLimit, 100)},
        order: {type: 'string', allowedValues: ['asc', 'desc'], default: 'asc'},
        action_whitelist: {type: 'string[]', min: 1},
        action_blacklist: {type: 'string[]', min: 1},
    });

    return await getContractActionLogs(
        ctx.db, ctx.coreArgs.neftymarket_account,
        applyActionGreylistFilters(['lognewauct'], args),
        {auction_id: ctx.pathParams.auction_id},
        (args.page - 1) * args.limit, args.limit, args.order
    );
}
