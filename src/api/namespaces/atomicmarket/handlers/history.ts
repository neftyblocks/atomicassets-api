import {RequestValues} from '../../utils';
import {AtomicMarketContext} from '../index';
import QueryBuilder from '../../../builder';
import {filterQueryArgs} from '../../validation';

// TODO: Create general history endpoint
export async function getSalesHistoryAction(params: RequestValues, ctx: AtomicMarketContext): Promise<any> {
    const args = await filterQueryArgs(params, {
        collection_name: {type: 'list[name]'},
        template_id: {type: 'list[id]'},
        schema_name: {type: 'list[name]'},
        asset_id: {type: 'list[id]'},
        symbol: {type: 'string', min: 1}
    });

    const query = new QueryBuilder(
        'SELECT price.*, token.token_precision, token.token_contract, asset.template_mint ' +
        'FROM atomicmarket_stats_prices_master price, atomicassets_assets asset, atomicmarket_tokens token '
    );

    query.equal('price.market_contract', ctx.coreArgs.atomicmarket_account);
    query.addCondition(
        'price.assets_contract = asset.contract AND price.asset_id = asset.asset_id AND ' +
        'price.market_contract = token.market_contract AND price.symbol = token.token_symbol'
    );

    if (args.collection_name.length) {
        query.equalMany('price.collection_name', args.collection_name);
    }

    if (args.schema_name.length) {
        query.equalMany('price.schema_name', args.schema_name);
    }

    if (args.template_id.length) {
        if ((args.template_id.length === 1) && (args.template_id[0] === 'null')) {
            query.isNull('price.template_id');
        } else {
            query.equalMany('price.template_id', args.template_id);
        }
    }

    if (args.asset_id.length) {
        query.equalMany('price.asset_id', args.asset_id);
    }

    if (args.symbol) {
        query.equalMany('price.symbol', args.symbol.split(','));
    }

    query.append('ORDER BY price."time" DESC LIMIT 500');

    const result = await ctx.db.query(query.buildString(), query.buildValues());

    return result.rows.map(row => ({
        sale_id: row.listing_type === 'sale' ? row.listing_id : null,
        auction_id: row.listing_type === 'auction' ? row.listing_id : null,
        buyoffer_id: row.listing_type === 'buyoffer' ? row.listing_id : null,
        template_buyoffer_id: row.listing_type === 'template_buyoffer' ? row.listing_id : null,
        price: row.price,
        template_mint: row.template_mint,
        token_symbol: row.symbol,
        token_precision: row.token_precision,
        token_contract: row.token_contract,
        block_time: row.time,
    })).reverse();
}
