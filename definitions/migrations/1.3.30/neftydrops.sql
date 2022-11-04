ALTER TABLE neftydrops_drop_assets ADD COLUMN IF NOT EXISTS bank_name VARCHAR(13);
DROP VIEW IF EXISTS neftydrops_drops_master;
