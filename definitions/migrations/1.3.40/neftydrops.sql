ALTER TABLE neftydrops_claims ADD COLUMN IF NOT EXISTS from_trigger boolean NOT NULL DEFAULT false;

CREATE INDEX neftydrops_claims_from_trigger ON neftydrops_claims USING btree (from_trigger);
