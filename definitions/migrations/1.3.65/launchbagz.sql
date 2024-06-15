ALTER TABLE launchbagz_tokens ADD COLUMN IF NOT EXISTS tx_fee double precision NOT NULL DEFAULT 0.0;

CREATE INDEX IF NOT EXISTS launchbagz_tokens_tx_fee ON launchbagz_tokens USING btree (tx_fee);
