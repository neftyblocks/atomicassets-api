CREATE
    INDEX IF NOT EXISTS launchbagz_vestings_created_at_time ON launchbagz_vestings USING btree (created_at_time);
CREATE
    INDEX IF NOT EXISTS launchbagz_vestings_updated_at_time ON launchbagz_vestings USING btree (updated_at_time);
CREATE
    INDEX IF NOT EXISTS launchbagz_vestings_start_time ON launchbagz_vestings USING btree (start_time);
CREATE
    INDEX IF NOT EXISTS launchbagz_vestings_total_allocation ON launchbagz_vestings USING btree (total_allocation);

ALTER TABLE launchbagz_tokens ADD COLUMN IF NOT EXISTS split_vestings bigint[] NOT NULL DEFAULT '{}'::bigint[];
