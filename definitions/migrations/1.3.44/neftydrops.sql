ALTER TABLE neftydrops_drops ADD COLUMN IF NOT EXISTS referral_whitelist_id BIGINT default 0;

DROP VIEW IF EXISTS neftydrops_drops_master;
