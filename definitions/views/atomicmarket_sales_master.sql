CREATE OR REPLACE VIEW atomicmarket_sales_master AS
    SELECT DISTINCT ON (market_contract, sale_id)
        sale.market_contract,
        sale.assets_contract,
        sale.sale_id,

        sale.seller,
        sale.buyer,

        sale.offer_id,

        (CASE
            WHEN sale.final_price IS NOT NULL THEN sale.final_price
            WHEN pair.invert_delphi_pair IS NOT NULL AND pair.invert_delphi_pair = true THEN
                LEAST(sale.listing_price::decimal * delphi.median * power(10.0, delphi.quote_precision - delphi.base_precision - delphi.median_precision), 9223372036854775807)::bigint
            WHEN pair.invert_delphi_pair IS NOT NULL AND pair.invert_delphi_pair = false THEN
                LEAST((sale.listing_price::decimal / delphi.median) * power(10.0, delphi.median_precision + delphi.base_precision - delphi.quote_precision), 9223372036854775807)::bigint
            ELSE sale.listing_price
        END) raw_price,
        token.token_precision raw_token_precision,
        token.token_symbol raw_token_symbol,

        json_build_object(
            'token_contract', token.token_contract,
            'token_symbol', token.token_symbol,
            'token_precision', token.token_precision,
            'median', delphi.median
        ) price,

        sale.listing_price,
        sale.listing_symbol,

        ARRAY(
            SELECT asset.asset_id
            FROM atomicassets_offers_assets asset
            WHERE sale.assets_contract = asset.contract AND asset.offer_id = sale.offer_id
        ) assets,

        sale.maker_marketplace,
        sale.taker_marketplace,

        sale.collection_name,
        json_build_object(
            'collection_name', collection.collection_name,
            'name', collection.data->>'name',
            'img', collection.data->>'img',
            'images', collection.data->>'images',
            'author', collection.author,
            'allow_notify', collection.allow_notify,
            'authorized_accounts', collection.authorized_accounts,
            'notify_accounts', collection.notify_accounts,
            'market_fee', sale.collection_fee,
            'created_at_block', collection.created_at_block::text,
            'created_at_time', collection.created_at_time::text
        ) collection,

        sale.state sale_state,
        offer.state offer_state,

        EXISTS(SELECT * FROM contract_codes WHERE account = sale.seller) is_seller_contract,

        sale.updated_at_block,
        sale.updated_at_time,
        sale.created_at_block,
        sale.created_at_time
    FROM
        atomicmarket_sales sale LEFT JOIN atomicmarket_symbol_pairs pair ON (
            pair.market_contract = sale.market_contract AND
            pair.listing_symbol = sale.listing_symbol AND
            pair.settlement_symbol = sale.settlement_symbol
        ) LEFT JOIN delphioracle_pairs delphi ON (
            pair.delphi_contract = delphi.contract AND
            pair.delphi_pair_name = delphi.delphi_pair_name
        ),
        atomicassets_offers offer, atomicassets_collections collection, atomicmarket_tokens token
    WHERE
        sale.assets_contract = offer.contract AND sale.offer_id = offer.offer_id AND
        collection.contract = sale.assets_contract AND collection.collection_name = sale.collection_name AND
        sale.market_contract = token.market_contract AND sale.settlement_symbol = token.token_symbol
