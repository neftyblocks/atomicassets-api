CREATE OR REPLACE VIEW neftymarket_auctions_master AS
    SELECT DISTINCT ON (market_contract, auction_id)
        auction.market_contract,
        auction.assets_contract,
        auction.auction_id,

        auction.seller,
        auction.buyer,

        auction.price raw_price,
        token.token_precision raw_token_precision,
        token.token_symbol raw_token_symbol,

        json_build_object(
            'token_contract', token.token_contract,
            'token_symbol', token.token_symbol,
            'token_precision', token.token_precision,
            'amount', auction.price::text
        ) price,

        json_build_object(
            'token_contract', token.token_contract,
            'token_symbol', token.token_symbol,
            'token_precision', token.token_precision,
            'amount', auction.min_price::text
        ) min_price,

        (CASE WHEN auction.buy_now_price > 0 THEN json_build_object(
            'token_contract', token.token_contract,
            'token_symbol', token.token_symbol,
            'token_precision', token.token_precision,
            'amount', auction.buy_now_price::text
        ) END) original_buy_now_price,

        (CASE WHEN price.buy_now_price > 0 THEN json_build_object(
            'token_contract', token.token_contract,
            'token_symbol', token.token_symbol,
            'token_precision', token.token_precision,
            'amount', price.buy_now_price::text
        ) END) buy_now_price,
        ARRAY(
            SELECT asset.asset_id
            FROM neftymarket_auctions_assets asset
            WHERE auction.auction_id = asset.auction_id AND asset.market_contract = auction.market_contract
            ORDER BY "index" ASC
        ) assets,

        ARRAY(
            SELECT
                json_build_object(
                    'number', bid.bid_number,
                    'account', bid.account,
                    'amount', bid.amount::text,
                    'created_at_block', bid.created_at_block::text,
                    'created_at_time', bid.created_at_time::text,
                    'txid', encode(bid.txid::bytea, 'hex')
                )
            FROM neftymarket_auctions_bids bid
            WHERE bid.market_contract = auction.market_contract AND bid.auction_id = auction.auction_id
            ORDER BY bid.bid_number ASC
        ) bids,

        auction.claimed_by_buyer,
        auction.claimed_by_seller,

        auction.collection_name,
        json_build_object(
            'collection_name', collection.collection_name,
            'name', collection.data->>'name',
            'img', collection.data->>'img',
            'author', collection.author,
            'allow_notify', collection.allow_notify,
            'authorized_accounts', collection.authorized_accounts,
            'notify_accounts', collection.notify_accounts,
            'market_fee', auction.collection_fee,
            'created_at_block', collection.created_at_block::text,
            'created_at_time', collection.created_at_time::text,
            'lists', COALESCE(lists.lists, '[]'::json),
            'tags', COALESCE(tags.tags, ARRAY[]::text[])
        ) collection,

        auction.state auction_state,

        auction.auction_type,
        auction.start_time,
        auction.end_time,
        auction.discount_rate,
        auction.discount_interval,

        EXISTS(SELECT * FROM contract_codes WHERE account = auction.seller) is_seller_contract,

        auction.updated_at_block,
        auction.updated_at_time,
        auction.created_at_block,
        auction.created_at_time
    FROM neftymarket_auctions auction LEFT JOIN neftymarket_auction_prices price ON (auction.market_contract = price.market_contract AND auction.auction_id = price.auction_id), atomicassets_collections collection, neftymarket_tokens token
    LEFT JOIN LATERAL (
        SELECT JSON_AGG(
                       JSON_BUILD_OBJECT(
                               'contract', contract,
                               'list', list
                       )
               ) lists
        from helpers_collection_list
        WHERE collection_name = collection.collection_name
        ) as lists ON true
    LEFT JOIN LATERAL (
        SELECT ARRAY_AGG(tag) tags
        from helpers_collection_tags
        WHERE collection_name = collection.collection_name
        ) as tags ON true
    WHERE auction.market_contract = token.market_contract AND auction.token_symbol = token.token_symbol AND
        auction.assets_contract = collection.contract AND auction.collection_name = collection.collection_name
