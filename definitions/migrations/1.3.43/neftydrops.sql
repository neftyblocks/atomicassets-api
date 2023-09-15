ALTER TABLE neftydrops_drops ADD COLUMN IF NOT EXISTS referral_fee DOUBLE PRECISION default 0;
ALTER TABLE neftydrops_claims ADD COLUMN IF NOT EXISTS referral_fee DOUBLE PRECISION default 0;
ALTER TABLE neftydrops_claims ADD COLUMN IF NOT EXISTS referrer_account VARCHAR(13) default NULL;

DROP VIEW IF EXISTS neftydrops_drops_master;
DROP VIEW IF EXISTS neftydrops_claims_master;
