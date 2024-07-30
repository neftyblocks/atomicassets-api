ALTER TABLE launchbagz_tokens DROP CONSTRAINT IF EXISTS launchbagz_tokens_pkey;
DROP INDEX IF EXISTS launchbagz_tokens_token_contract_code;

ALTER TABLE launchbagz_tokens ADD PRIMARY KEY (token_contract, token_code);
CREATE INDEX IF NOT EXISTS launchbagz_tokens_contract ON launchbagz_tokens USING btree (contract);

UPDATE launchbagz_tokens SET contract = 'chadtoken.gm' WHERE token_contract = 'chadtoken.gm';
UPDATE launchbagz_tokens SET contract = 'waxpepetoken' WHERE token_contract = 'waxpepetoken';
UPDATE launchbagz_tokens SET contract = 'supergrinch1' WHERE token_contract = 'supergrinch1';
UPDATE launchbagz_tokens SET contract = 'guda.guda' WHERE token_contract = 'guda.guda';
