ALTER TABLE neftyblends_blends ADD COLUMN IF NOT EXISTS category VARCHAR(255) NOT NULL DEFAULT '';

CREATE
    INDEX IF NOT EXISTS neftyblends_blends_category ON neftyblends_blends USING btree (category);
