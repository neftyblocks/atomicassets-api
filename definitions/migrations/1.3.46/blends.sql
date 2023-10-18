CREATE OR REPLACE FUNCTION safe_cast_to_jsonb(value text) RETURNS jsonb AS $$
BEGIN
    RETURN value::jsonb;
EXCEPTION WHEN OTHERS THEN
    RETURN '{}'::jsonb;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE neftyblends_blends ADD COLUMN IF NOT EXISTS name text;

UPDATE neftyblends_blends SET name = safe_cast_to_jsonb(display_data)->>'name';

DROP FUNCTION safe_cast_to_jsonb;


ALTER TABLE neftyblends_blends ADD COLUMN IF NOT EXISTS is_available boolean
    GENERATED ALWAYS AS (
        CASE
            WHEN max = 0 THEN true
            ELSE (max - use_count) > 0
            END
        ) STORED;

-- Indexes
CREATE
    INDEX IF NOT EXISTS neftyblends_blends_is_available ON neftyblends_blends USING btree (is_available);

CREATE
    INDEX IF NOT EXISTS neftyblends_blends_name ON neftyblends_blends USING gist ((name) gist_trgm_ops);
