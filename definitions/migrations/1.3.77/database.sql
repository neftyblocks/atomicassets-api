UPDATE dbinfo SET "value" = '1.3.77' WHERE name = 'version';

DROP INDEX IF EXISTS contract_traces_metadata;
CREATE INDEX IF NOT EXISTS contract_traces_idx_metadata ON contract_traces USING GIN (metadata jsonb_path_ops);

ANALYZE contract_traces;
