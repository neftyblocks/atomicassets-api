CREATE INDEX IF NOT EXISTS atomicassets_assets_owner_gin ON atomicassets_assets USING gin (owner gin_trgm_ops);
