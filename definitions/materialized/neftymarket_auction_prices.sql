CREATE MATERIALIZED VIEW IF NOT EXISTS neftymarket_auction_prices AS
SELECT market_contract,
       auction_id,
       CASE
           WHEN auction_type = 1 AND buyer IS NULL
               THEN LEAST(
                   (
                       ROUND(
                                   buy_now_price *
                                   POWER(
                                               1.0 - discount_rate,
                                               FLOOR((LEAST(FLOOR(extract(epoch from now())* 1000), end_time) - start_time) / discount_interval)
                                       )
                           )
                       ),
                   min_price
               )
           ELSE buy_now_price
           END
           as buy_now_price_dynamic
FROM neftymarket_auctions auction
WHERE buy_now_price > 0;
