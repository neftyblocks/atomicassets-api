CREATE
OR REPLACE VIEW neftydrops_drops_master AS
SELECT DISTINCT
ON (drops_contract, drop_id)
    ndrop.drops_contract,
    ndrop.assets_contract,
    ndrop.drop_id,

    (CASE
    WHEN pair.invert_delphi_pair IS NOT NULL AND pair.invert_delphi_pair = true THEN
    LEAST(ndrop.listing_price:: decimal * delphi.median * power(10.0, delphi.quote_precision - delphi.base_precision - delphi.median_precision), 9223372036854775807)::bigint
    WHEN pair.invert_delphi_pair IS NOT NULL AND pair.invert_delphi_pair = false THEN
    LEAST((ndrop.listing_price:: decimal / delphi.median) * power(10.0, delphi.median_precision + delphi.base_precision - delphi.quote_precision), 9223372036854775807)::bigint
    ELSE ndrop.listing_price
    END) raw_price,

    (CASE
    WHEN ndrop.settlement_symbol = 'NULL' THEN 0
    ELSE token.token_precision
    END) raw_token_precision,

    (CASE
    WHEN ndrop.settlement_symbol = 'NULL' THEN 'NULL':: VARCHAR (12)
    ELSE token.token_symbol
    END) raw_token_symbol,

    json_build_object(
    'token_contract', (CASE
    WHEN ndrop.settlement_symbol = 'NULL' THEN '':: VARCHAR (12)
    ELSE token.token_contract
    END),
    'token_symbol', (CASE
    WHEN ndrop.settlement_symbol = 'NULL' THEN 'NULL':: VARCHAR (12)
    ELSE token.token_symbol
    END),
    'token_precision', (CASE
    WHEN ndrop.settlement_symbol = 'NULL' THEN 0
    ELSE token.token_precision
    END),
    'median', delphi.median
    ) price,

    ndrop.listing_price,
    ndrop.listing_symbol,

    (
    SELECT json_agg(row_to_json(asset))
    FROM neftydrops_drop_assets asset
    WHERE ndrop.assets_contract = asset.assets_contract AND asset.drop_id = ndrop.drop_id
    ) assets,

    ndrop.collection_name,
    json_build_object(
    'collection_name', collection.collection_name,
    'name', collection.data->>'name',
    'img', collection.data->>'img',
    'author', collection.author,
    'allow_notify', collection.allow_notify,
    'authorized_accounts', collection.authorized_accounts,
    'notify_accounts', collection.notify_accounts,
    'created_at_block', collection.created_at_block::text,
    'created_at_time', collection.created_at_time::text,
    'lists', COALESCE(lists.lists, '[]'::json),
    'tags', COALESCE(tags.tags, ARRAY[]::text[])
    ) collection,

    ndrop.is_deleted is_deleted,
    ndrop.is_hidden is_hidden,
    ndrop.updated_at_block,
    ndrop.updated_at_time,
    ndrop.created_at_block,
    ndrop.created_at_time,
    ndrop.preminted,
    ndrop.start_time,
    ndrop.end_time,
    ndrop.display_data,
    ndrop.auth_required,
    ndrop.account_limit,
    ndrop.account_limit_cooldown,
    ndrop.max_claimable,
    ndrop.current_claimed,
    ndrop.price_recipient,
    ndrop.allow_credit_card_payments,
    ndrop.referral_fee,
    ndrop.referral_whitelist_id,
    alternative_prices
FROM
    neftydrops_drops ndrop LEFT JOIN neftydrops_symbol_pairs pair
ON (
    pair.drops_contract = ndrop.drops_contract AND
    pair.listing_symbol = ndrop.listing_symbol AND
    pair.settlement_symbol = ndrop.settlement_symbol
    ) LEFT JOIN delphioracle_pairs delphi ON (
    pair.delphi_contract = delphi.contract AND
    pair.delphi_pair_name = delphi.delphi_pair_name
    ),
    atomicassets_collections collection, neftydrops_tokens token
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
LEFT JOIN LATERAL (
    SELECT JSON_AGG(
                   JSON_BUILD_OBJECT(
                           'amount', price,
                           'token_contract', token.token_contract,
                           'token_symbol', token.token_symbol,
                           'token_precision', token.token_precision

                       )
               ) alternative_prices
    from neftydrops_drops_alternative_prices p, neftydrops_tokens token
    WHERE p.drop_id = ndrop.drop_id AND p.symbol = token.token_symbol
    ) as alternative_prices ON true
WHERE
    collection.contract = ndrop.assets_contract
  AND collection.collection_name = ndrop.collection_name
  AND
    ndrop.drops_contract = token.drops_contract
  AND (ndrop.settlement_symbol = token.token_symbol
   OR ndrop.settlement_symbol = 'NULL')
