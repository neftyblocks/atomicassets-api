ALTER TABLE neftydrops_drops ADD COLUMN IF NOT EXISTS allow_credit_card_payments BOOLEAN default false;
DROP VIEW IF EXISTS neftydrops_drops_master;
