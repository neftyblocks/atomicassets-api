ALTER TABLE neftydrops_drops ADD COLUMN IF NOT EXISTS is_available boolean
    GENERATED ALWAYS AS (
        CASE
            WHEN max_claimable = 0 THEN true
            ELSE (max_claimable - current_claimed) > 0
            END
        ) STORED;

-- Indexes
CREATE
    INDEX IF NOT EXISTS neftydrops_drops_is_available ON neftydrops_drops USING btree (is_available);
