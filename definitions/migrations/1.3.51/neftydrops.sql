ALTER TABLE neftydrops_claims ADD COLUMN IF NOT EXISTS symbol VARCHAR(12)
    GENERATED ALWAYS AS (
        CASE
            WHEN settlement_symbol = 'NULL' THEN 'WAX':: VARCHAR(12)
            WHEN core_symbol IS NOT NULL THEN core_symbol
            ELSE settlement_symbol
            END
        ) STORED;

ALTER TABLE neftydrops_claims ADD COLUMN IF NOT EXISTS price bigint
    GENERATED ALWAYS AS (
        CASE
            WHEN core_symbol IS NOT NULL THEN core_amount
            ELSE total_price
            END
        ) STORED;

-- Indexes
CREATE INDEX neftydrops_claims_drop_id_symbol ON neftydrops_claims (drop_id, symbol);
CREATE INDEX neftydrops_claims_price ON neftydrops_claims USING btree (price);
CREATE INDEX neftydrops_claims_collection_name ON neftydrops_claims USING btree (collection_name);

DROP VIEW IF EXISTS neftydrops_stats_master;
