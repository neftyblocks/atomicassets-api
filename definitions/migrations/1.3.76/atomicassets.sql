ALTER TABLE atomicassets_assets_backed_tokens ADD COLUMN IF NOT EXISTS token_contract character varying(12);
ALTER TABLE atomicassets_assets_backed_tokens ADD COLUMN IF NOT EXISTS token_precision integer;
ALTER TABLE atomicassets_assets_backed_tokens ADD COLUMN IF NOT EXISTS custodian_contract character varying(12);

UPDATE atomicassets_assets_backed_tokens bt
SET token_contract = tok.token_contract,
    token_precision = tok.token_precision,
    custodian_contract = tok.contract
FROM (
  SELECT a.contract, a.asset_id, a.token_symbol, t.token_contract, t.token_precision
  FROM atomicassets_assets_backed_tokens a
  INNER JOIN atomicassets_tokens t ON a.token_symbol = t.token_symbol
) tok
WHERE bt.contract = tok.contract AND bt.asset_id = tok.asset_id AND bt.token_symbol = tok.token_symbol;

ALTER TABLE atomicassets_assets_backed_tokens ALTER COLUMN token_contract SET NOT NULL;
ALTER TABLE atomicassets_assets_backed_tokens ALTER COLUMN token_precision SET NOT NULL;
ALTER TABLE atomicassets_assets_backed_tokens ALTER COLUMN custodian_contract SET NOT NULL;

ALTER TABLE atomicassets_assets_backed_tokens DROP CONSTRAINT IF EXISTS atomicassets_assets_backed_tokens_symbol_fkey;
ALTER TABLE atomicassets_assets_backed_tokens DROP CONSTRAINT atomicassets_assets_backed_tokens_pkey;

ALTER TABLE atomicassets_assets_backed_tokens ADD CONSTRAINT atomicassets_assets_backed_tokens_pkey PRIMARY KEY (contract, asset_id, token_symbol, token_contract, custodian_contract);
