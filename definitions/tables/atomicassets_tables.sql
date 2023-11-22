-- CREATE TABLES --
CREATE TABLE atomicassets_assets (
    contract character varying(12) NOT NULL,
    asset_id bigint NOT NULL,
    collection_name character varying(12) NOT NULL,
    schema_name character varying(12) NOT NULL,
    template_id bigint,
    owner character varying(12),
    mutable_data jsonb,
    immutable_data jsonb,
    template_mint INT,
    burned_by_account character varying(12),
    burned_at_block bigint,
    burned_at_time bigint,
    transferred_at_block bigint NOT NULL,
    transferred_at_time bigint NOT NULL,
    updated_at_block bigint NOT NULL,
    updated_at_time bigint NOT NULL,
    minted_at_block bigint NOT NULL,
    minted_at_time bigint NOT NULL,
    CONSTRAINT atomicassets_assets_pkey PRIMARY KEY (contract, asset_id)
);

CREATE TABLE atomicassets_assets_backed_tokens (
    contract character varying(12) NOT NULL,
    asset_id bigint NOT NULL,
    token_symbol character varying(12) NOT NULL,
    amount bigint NOT NULL,
    updated_at_block bigint NOT NULL,
    updated_at_time bigint NOT NULL,
    CONSTRAINT atomicassets_assets_backed_tokens_pkey PRIMARY KEY (contract, asset_id, token_symbol)
);

CREATE TABLE atomicassets_mints (
    contract character varying(12) NOT NULL,
    asset_id bigint NOT NULL,
    minter character varying(12) NOT NULL,
    receiver character varying(12) NOT NULL,
    txid bytea NOT NULL,
    CONSTRAINT atomicassets_mints_pkey PRIMARY KEY (contract, asset_id)
);

CREATE TABLE atomicassets_balances (
    contract character varying(12) NOT NULL,
    owner character varying(12) NOT NULL,
    token_symbol character varying(12) NOT NULL,
    amount bigint NOT NULL,
    updated_at_block bigint NOT NULL,
    updated_at_time bigint NOT NULL,
    CONSTRAINT atomicassets_balances_pkey PRIMARY KEY (contract, owner, token_symbol)
);

CREATE TABLE atomicassets_collections (
    contract character varying(12) NOT NULL,
    collection_name character varying(12) NOT NULL,
    author character varying(12) NOT NULL,
    allow_notify boolean NOT NULL,
    authorized_accounts character varying(12)[] NOT NULL,
    notify_accounts character varying(12)[] NOT NULL,
    market_fee double precision NOT NULL,
    data jsonb,
    created_at_block bigint NOT NULL,
    created_at_time bigint NOT NULL,
    CONSTRAINT atomicassets_collections_pkey PRIMARY KEY (contract, collection_name)
);

CREATE TABLE atomicassets_config (
    contract character varying(12) NOT NULL,
    version character varying(64) NOT NULL,
    collection_format jsonb[] NOT NULL,
    CONSTRAINT atomicassets_config_pkey PRIMARY KEY (contract)
);

CREATE TABLE atomicassets_offers (
    contract character varying(12) NOT NULL,
    offer_id bigint NOT NULL,
    sender character varying(12) NOT NULL,
    recipient character varying(12) NOT NULL,
    memo character varying(256) NOT NULL,
    state smallint NOT NULL,
    updated_at_time bigint NOT NULL,
    updated_at_block bigint NOT NULL,
    created_at_time bigint NOT NULL,
    created_at_block bigint NOT NULL,
    CONSTRAINT atomicassets_offers_pkey PRIMARY KEY (contract, offer_id)
);

CREATE TABLE atomicassets_offers_assets (
    contract character varying(12) NOT NULL,
    offer_id bigint NOT NULL,
    owner character varying(12) NOT NULL,
    "index" integer NOT NULL,
    asset_id bigint NOT NULL,
    CONSTRAINT atomicassets_offers_assets_pkey PRIMARY KEY (contract, offer_id, asset_id)
);

CREATE TABLE atomicassets_templates (
    contract character varying(12) NOT NULL,
    template_id bigint NOT NULL,
    collection_name character varying(12) NOT NULL,
    schema_name character varying(12) NOT NULL,
    transferable boolean NOT NULL,
    burnable boolean NOT NULL,
    max_supply bigint NOT NULL,
    issued_supply bigint NOT NULL,
    immutable_data jsonb,
    created_at_time bigint NOT NULL,
    created_at_block bigint NOT NULL,
    CONSTRAINT atomicassets_templates_pkey PRIMARY KEY (contract, template_id)
);

CREATE TABLE atomicassets_schemas (
    contract character varying(12) NOT NULL,
    collection_name character varying(12) NOT NULL,
    schema_name character varying(12) NOT NULL,
    format jsonb[] NOT NULL,
    created_at_block bigint NOT NULL,
    created_at_time bigint NOT NULL,
    CONSTRAINT atomicassets_schemas_pkey PRIMARY KEY (contract, collection_name, schema_name)
);

CREATE TABLE atomicassets_tokens (
    contract character varying(12) NOT NULL,
    token_symbol character varying(12) NOT NULL,
    token_contract character varying(12) NOT NULL,
    token_precision integer NOT NULL,
    CONSTRAINT atomicassets_tokens_pkey PRIMARY KEY (contract, token_symbol)
);

CREATE TABLE atomicassets_transfers (
    transfer_id bigint NOT NULL,
    contract character varying(12) NOT NULL,
    "sender" character varying(12) NOT NULL,
    "recipient" character varying(12) NOT NULL,
    memo character varying(256) NOT NULL,
    txid bytea NOT NULL,
    created_at_block bigint NOT NULL,
    created_at_time bigint NOT NULL,
    CONSTRAINT atomicassets_transfers_pkey PRIMARY KEY (contract, transfer_id)
);

CREATE TABLE atomicassets_transfers_assets (
    transfer_id bigint NOT NULL,
    contract character varying(12) NOT NULL,
    "index" integer NOT NULL,
    asset_id bigint NOT NULL,
    CONSTRAINT atomicassets_transfers_assets_pkey PRIMARY KEY (transfer_id, contract, asset_id)
);

-- FOREIGN KEYS --
ALTER TABLE ONLY atomicassets_assets_backed_tokens
    ADD CONSTRAINT atomicassets_assets_backed_tokens_assets_fkey FOREIGN KEY (asset_id, contract) REFERENCES atomicassets_assets(asset_id, contract) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

ALTER TABLE ONLY atomicassets_assets_backed_tokens
    ADD CONSTRAINT atomicassets_assets_backed_tokens_symbol_fkey FOREIGN KEY (token_symbol, contract) REFERENCES atomicassets_tokens(token_symbol, contract) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

ALTER TABLE ONLY atomicassets_assets
    ADD CONSTRAINT atomicassets_assets_collections_fkey FOREIGN KEY (contract, collection_name) REFERENCES atomicassets_collections(contract, collection_name) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

ALTER TABLE ONLY atomicassets_assets
    ADD CONSTRAINT atomicassets_assets_templates_fkey FOREIGN KEY (template_id, contract) REFERENCES atomicassets_templates(template_id, contract) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

ALTER TABLE ONLY atomicassets_assets
    ADD CONSTRAINT atomicassets_assets_schemas_fkey FOREIGN KEY (collection_name, schema_name, contract) REFERENCES atomicassets_schemas(collection_name, schema_name, contract) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

ALTER TABLE ONLY atomicassets_balances
    ADD CONSTRAINT atomicassets_balances_symbols_fkey FOREIGN KEY (token_symbol, contract) REFERENCES atomicassets_tokens(token_symbol, contract) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

ALTER TABLE ONLY atomicassets_offers_assets
    ADD CONSTRAINT atomicassets_offers_assets_offers_fkey FOREIGN KEY (offer_id, contract) REFERENCES atomicassets_offers(offer_id, contract) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

ALTER TABLE ONLY atomicassets_templates
    ADD CONSTRAINT atomicassets_templates_collections_fkey FOREIGN KEY (collection_name, contract) REFERENCES atomicassets_collections(collection_name, contract) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

ALTER TABLE ONLY atomicassets_templates
    ADD CONSTRAINT atomicassets_templates_schemas_fkey FOREIGN KEY (collection_name, schema_name, contract) REFERENCES atomicassets_schemas(collection_name, schema_name, contract) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

ALTER TABLE ONLY atomicassets_schemas
    ADD CONSTRAINT atomicassets_schemas_collection_fkey FOREIGN KEY (collection_name, contract) REFERENCES atomicassets_collections(collection_name, contract) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

ALTER TABLE ONLY atomicassets_transfers_assets
    ADD CONSTRAINT atomicassets_transfers_assets_transfers_fkey FOREIGN KEY (contract, transfer_id) REFERENCES atomicassets_transfers(contract, transfer_id) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

-- INDEXES --
CREATE INDEX atomicassets_assets_asset_id ON atomicassets_assets USING btree (asset_id);
CREATE INDEX atomicassets_assets_collection_name_btree ON atomicassets_assets USING btree (collection_name);
CREATE INDEX atomicassets_assets_template_id_asset_id ON atomicassets_assets (template_id, asset_id);
CREATE INDEX atomicassets_assets_schema_name ON atomicassets_assets USING btree (schema_name);
CREATE INDEX atomicassets_assets_owner_gin ON atomicassets_assets USING gin (owner gin_trgm_ops);
CREATE INDEX atomicassets_assets_owner_btree ON atomicassets_assets USING btree (owner);
CREATE INDEX atomicassets_assets_mutable_data ON atomicassets_assets USING gin (mutable_data);
CREATE INDEX atomicassets_assets_immutable_data ON atomicassets_assets USING gin (immutable_data);
CREATE INDEX atomicassets_assets_template_mint ON atomicassets_assets USING btree (template_mint);
CREATE INDEX atomicassets_assets_burned_by_account ON atomicassets_assets USING btree (burned_by_account);
CREATE INDEX atomicassets_assets_burned_at_time ON atomicassets_assets USING btree (burned_at_time);
CREATE INDEX atomicassets_assets_updated_at_time ON atomicassets_assets USING btree (updated_at_time);
CREATE INDEX atomicassets_assets_transferred_at_time ON atomicassets_assets USING btree (transferred_at_time);
CREATE INDEX atomicassets_assets_minted_at_time ON atomicassets_assets USING btree (minted_at_time);
CREATE INDEX atomicassets_assets_missing_mint ON atomicassets_assets USING btree (template_id, asset_id) WHERE template_id IS NOT NULL AND template_mint IS NULL;

CREATE INDEX atomicassets_assets_backed_tokens_asset_id ON atomicassets_assets_backed_tokens USING btree (asset_id);

CREATE INDEX atomicassets_mints_asset_id ON atomicassets_mints USING btree (asset_id);
CREATE INDEX atomicassets_mints_minter ON atomicassets_mints USING btree (minter);
CREATE INDEX atomicassets_mints_receiver ON atomicassets_mints USING btree (receiver);

CREATE INDEX atomicassets_balances_owner_btree ON atomicassets_balances USING btree (owner);
CREATE INDEX atomicassets_balances_updated_at_time ON atomicassets_balances USING btree (updated_at_time);

CREATE INDEX atomicassets_collections_collection_name ON atomicassets_collections USING btree (collection_name);
CREATE INDEX atomicassets_collections_author ON atomicassets_collections USING btree (author);
CREATE INDEX atomicassets_collections_created_at_time ON atomicassets_collections USING btree (created_at_time);

CREATE INDEX atomicassets_offers_offer_id ON atomicassets_offers USING btree (offer_id);
CREATE INDEX atomicassets_offers_sender ON atomicassets_offers USING btree (sender);
CREATE INDEX atomicassets_offers_recipient ON atomicassets_offers USING btree (recipient);
CREATE INDEX atomicassets_offers_state ON atomicassets_offers USING btree (state);
CREATE INDEX atomicassets_offers_updated_at_time ON atomicassets_offers USING btree (updated_at_time);
CREATE INDEX atomicassets_offers_created_at_time ON atomicassets_offers USING btree (created_at_time);

CREATE INDEX atomicassets_offers_assets_offer_id ON atomicassets_offers_assets USING btree (offer_id);
CREATE INDEX atomicassets_offers_assets_asset_id ON atomicassets_offers_assets USING btree (asset_id);
CREATE INDEX atomicassets_offers_assets_owner ON atomicassets_offers_assets USING btree (owner);

CREATE INDEX atomicassets_templates_template_id ON atomicassets_templates USING btree (template_id);
CREATE INDEX atomicassets_templates_collection_name ON atomicassets_templates USING btree (collection_name);
CREATE INDEX atomicassets_templates_schema_name ON atomicassets_templates USING btree (schema_name);
CREATE INDEX atomicassets_templates_immutable_data_gin ON atomicassets_templates USING gin (immutable_data);
CREATE INDEX atomicassets_templates_created_at_time ON atomicassets_templates USING btree (created_at_time);

CREATE INDEX atomicassets_schemas_schema_name ON atomicassets_schemas USING btree (schema_name);
CREATE INDEX atomicassets_schemas_collection_name ON atomicassets_schemas USING btree (collection_name);
CREATE INDEX atomicassets_schemas_created_at_time ON atomicassets_schemas USING btree (created_at_time);

CREATE INDEX atomicassets_transfers_sender ON atomicassets_transfers USING btree (sender);
CREATE INDEX atomicassets_transfers_recipient ON atomicassets_transfers USING btree (recipient);
CREATE INDEX atomicassets_transfers_created_at_time ON atomicassets_transfers USING btree (created_at_time);

CREATE INDEX atomicassets_transfers_assets_asset_id ON atomicassets_transfers_assets USING btree (asset_id);
