CREATE OR REPLACE VIEW neftydrops_stats_master AS
SELECT claim.drops_contract,
       'drop'                listing_type,
       claim.claim_id        listing_id,
       claim.claimer         buyer,
       claim.collection_name seller,
       'NB'                  marker_marketplace,
       'NB'                  taker_marketplace,
       claim.assets_contract assets_contract,
       claim.collection_name collection_name,
       claim.symbol          symbol,
       claim.price           price,
       claim.created_at_time "time",
       claim.drop_id         drop_id
FROM neftydrops_claims claim
WHERE claim.final_price IS NOT NULL
