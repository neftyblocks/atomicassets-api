CREATE TABLE neftydrops_drops
(
    drops_contract         character varying(12) NOT NULL,
    assets_contract        character varying(12) NOT NULL,
    drop_id                bigint                NOT NULL,
    collection_name        character varying(12),
    listing_price          bigint                NOT NULL,
    listing_symbol         character varying(12),
    settlement_symbol      character varying(12) NOT NULL,
    price_recipient        character varying(12),
    auth_required          boolean,
    preminted              boolean,
    account_limit          bigint                NOT NULL,
    account_limit_cooldown bigint                NOT NULL,
    max_claimable          bigint                NOT NULL,
    start_time             bigint                NOT NULL,
    end_time               bigint                NOT NULL,
    display_data           text                  NOT NULL,
    state                  smallint              NOT NULL,
    updated_at_block       bigint                NOT NULL,
    updated_at_time        bigint                NOT NULL,
    created_at_block       bigint                NOT NULL,
    created_at_time        bigint                NOT NULL,
    current_claimed        bigint                NOT NULL DEFAULT 0,
    is_deleted             boolean               NOT NULL DEFAULT false,
    is_hidden              boolean               NOT NULL DEFAULT false,

    CONSTRAINT neftydrops_drops_pkey PRIMARY KEY (drops_contract, drop_id)
);

CREATE TABLE neftydrops_drop_assets
(
    drops_contract  character varying(12) NOT NULL,
    assets_contract character varying(12) NOT NULL,
    drop_id         bigint                NOT NULL,
    collection_name character varying(12),
    template_id     bigint                NOT NULL,
    use_pool        boolean,
    tokens_to_back  character varying(100)[],
    "index"         integer               NOT NULL,

    CONSTRAINT neftydrops_drop_assets_pkey PRIMARY KEY (drops_contract, drop_id, index)
);

CREATE TABLE neftydrops_drops_alternative_prices
(
    drops_contract  character varying(12) NOT NULL,
    assets_contract character varying(12) NOT NULL,
    drop_id         bigint                NOT NULL,
    price_index     integer               NOT NULL,
    price           bigint                NOT NULL,
    symbol          character varying(12) NOT NULL,

    CONSTRAINT neftydrops_drops_alternative_prices_pkey PRIMARY KEY (drops_contract, drop_id, price_index)
);

CREATE TABLE neftydrops_claims
(
    claim_id          bigint                NOT NULL,
    drops_contract    character varying(12) NOT NULL,
    assets_contract   character varying(12) NOT NULL,
    claimer           character varying(12) NOT NULL,
    drop_id           bigint                NOT NULL,
    collection_name   character varying(12),
    amount            bigint                NOT NULL,
    final_price       bigint,
    total_price       bigint,
    listing_symbol    character varying(12),
    settlement_symbol character varying(12),
    referrer          text                  NOT NULL,
    country           text                  NOT NULL,
    txid              bytea                 NOT NULL,
    created_at_block  bigint                NOT NULL,
    created_at_time   bigint                NOT NULL,
    amount_spent      bigint,
    spent_symbol      character varying(12),
    core_amount       bigint,
    core_symbol       character varying(12),
    CONSTRAINT neftydrops_claims_pkey PRIMARY KEY (drops_contract, claim_id)
);

CREATE TABLE neftydrops_balances
(
    drops_contract   character varying(12) NOT NULL,
    owner            character varying(12) NOT NULL,
    token_symbol     character varying(12) NOT NULL,
    amount           bigint                NOT NULL,
    updated_at_block bigint                NOT NULL,
    updated_at_time  bigint                NOT NULL
);

CREATE TABLE neftydrops_tokens
(
    drops_contract  character varying(12) NOT NULL,
    token_contract  character varying(12) NOT NULL,
    token_symbol    character varying(12) NOT NULL,
    token_precision integer               NOT NULL,
    CONSTRAINT neftydrops_tokens_pkey PRIMARY KEY (drops_contract, token_symbol)
);

CREATE TABLE neftydrops_symbol_pairs
(
    drops_contract     character varying(12) NOT NULL,
    listing_symbol     character varying(12) NOT NULL,
    settlement_symbol  character varying(12) NOT NULL,
    delphi_contract    character varying(12) NOT NULL,
    delphi_pair_name   character varying(12) NOT NULL,
    invert_delphi_pair boolean               NOT NULL,
    CONSTRAINT neftydrops_delphi_pairs_pkey PRIMARY KEY (drops_contract, listing_symbol, settlement_symbol)
);

CREATE TABLE neftydrops_config
(
    drops_contract     character varying(12) NOT NULL,
    assets_contract    character varying(12) NOT NULL,
    delphi_contract    character varying(12) NOT NULL,
    version            character varying(64) NOT NULL,
    drop_fee           double precision      NOT NULL,
    drop_fee_recipient character varying(12) NOT NULL,
    CONSTRAINT neftydrops_config_pkey PRIMARY KEY (drops_contract)
);

CREATE TABLE neftydrops_account_stats
(
    claimer         character varying(12) NOT NULL,
    drop_id         bigint                NOT NULL,
    use_counter     bigint                NOT NULL,
    last_claim_time bigint                NOT NULL,
    used_nonces     bigint[]              NOT NULL,

    CONSTRAINT neftydrops_account_stats_pkey PRIMARY KEY (claimer, drop_id)
);

CREATE TABLE neftydrops_accounts_whitelist
(
    drop_id       bigint                NOT NULL,
    account       character varying(12) NOT NULL,
    account_limit bigint                NOT NULL,

    CONSTRAINT neftydrops_accounts_whitelist_pkey PRIMARY KEY (drop_id, account)
);

CREATE TABLE neftydrops_authkeys
(
    drop_id            bigint                NOT NULL,
    public_key         character varying(53) NOT NULL,
    key_limit          bigint                NOT NULL,
    key_limit_cooldown bigint                NOT NULL,
    use_counter        bigint                NOT NULL,
    last_claim_time    bigint                NOT NULL,

    CONSTRAINT neftydrops_authkeys_pkey PRIMARY KEY (drop_id, public_key)
);

CREATE TABLE neftydrops_proof_of_ownership_filters
(
    drop_id             bigint                NOT NULL,
    filter_index        bigint                NOT NULL,

    -- All rows with the same drop_id must have the same logical_operator and
    -- total_filter_count
    logical_operator    smallint              NOT NULL,
    total_filter_count  bigint                NOT NULL,

    -- Either of four values 'COLLECTION_HOLDINGS', 'TEMPLATE_HOLDINGS',
    -- 'SCHEMA_HOLDINGS', or 'TOKEN_HOLDING'
    filter_kind         character varying(50) NOT NULL,

    -- Equal to the "..._holdings"->'comparison_operator' that is not null
    comparison_operator smallint              NOT NULL,

    -- NULL if filter_kind == 'TOKEN_HOLDING'.
    -- otherwise it is equal to the "..._holdings"->'amount' that is not null
    nft_amount          bigint,

    -- NULL if filter_kind != 'COLLECTION_HOLDINGS'
    collection_holdings jsonb,

    -- NULL if filter_kind != 'TEMPLATE_HOLDINGS'
    template_holdings   jsonb,

    -- NULL if filter_kind != 'SCHEMA_HOLDINGS'
    schema_holdings     jsonb,

    -- NULL if filter_kind != 'TOKEN_HOLDING'
    token_holding       jsonb,

    CONSTRAINT neftydrops_proof_of_ownership_filters_pkey PRIMARY KEY (drop_id, filter_index)
);

ALTER TABLE ONLY neftydrops_symbol_pairs
    ADD CONSTRAINT neftydrops_symbol_pairs_delphi_fkey FOREIGN KEY (delphi_contract, delphi_pair_name)
        REFERENCES delphioracle_pairs (contract, delphi_pair_name) MATCH SIMPLE ON
            UPDATE RESTRICT
        ON
            DELETE
            RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

ALTER TABLE ONLY neftydrops_drop_assets
    ADD CONSTRAINT neftydrops_drop_assets_drop_fkey FOREIGN KEY (drop_id, drops_contract) REFERENCES neftydrops_drops (drop_id, drops_contract) MATCH SIMPLE ON
        UPDATE RESTRICT
        ON
            DELETE
            RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

ALTER TABLE ONLY neftydrops_drops_alternative_prices
    ADD CONSTRAINT neftydrops_drops_alternative_prices_drop_fkey FOREIGN KEY (drop_id, drops_contract) REFERENCES neftydrops_drops (drop_id, drops_contract) MATCH SIMPLE ON
        UPDATE RESTRICT
        ON
            DELETE
            RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

-- Indexes
CREATE
    INDEX neftydrops_drops_drop_id ON neftydrops_drops USING btree (drop_id);
CREATE
    INDEX neftydrops_drops_collection_name ON neftydrops_drops USING hash (collection_name);
CREATE
    INDEX neftydrops_drops_collection_price ON neftydrops_drops USING btree (listing_price);
CREATE
    INDEX neftydrops_drops_collection_listing_symbol ON neftydrops_drops USING btree (listing_symbol);
CREATE
    INDEX neftydrops_drops_collection_settlement_symbol ON neftydrops_drops USING btree (settlement_symbol);
CREATE
    INDEX neftydrops_drops_collection_auth_required ON neftydrops_drops USING btree (auth_required);
CREATE
    INDEX neftydrops_drops_collection_preminted ON neftydrops_drops USING btree (preminted);
CREATE
    INDEX neftydrops_drops_collection_start_time ON neftydrops_drops USING btree (start_time);
CREATE
    INDEX neftydrops_drops_collection_end_time ON neftydrops_drops USING btree (end_time);
CREATE
    INDEX neftydrops_drops_created_at_time ON neftydrops_drops USING btree (created_at_time);
CREATE
    INDEX neftydrops_drops_updated_at_time ON neftydrops_drops USING btree (updated_at_time);

CREATE
    INDEX neftydrops_claims_drop_id ON neftydrops_claims USING btree (drop_id);
CREATE
    INDEX neftydrops_claims_amount ON neftydrops_claims USING btree (amount);
CREATE
    INDEX neftydrops_claims_final_price ON neftydrops_claims USING btree (final_price);
CREATE
    INDEX neftydrops_claims_total_price ON neftydrops_claims USING btree (total_price);
CREATE
    INDEX neftydrops_claims_listing_symbol ON neftydrops_claims USING hash (listing_symbol);
CREATE
    INDEX neftydrops_claims_settlement_symbol ON neftydrops_claims USING hash (settlement_symbol);
CREATE
    INDEX neftydrops_claims_referrer ON neftydrops_claims USING hash (referrer);
CREATE
    INDEX neftydrops_claims_country ON neftydrops_claims USING hash (country);
CREATE
    INDEX neftydrops_claims_claimer ON neftydrops_claims USING hash (claimer);
CREATE
    INDEX neftydrops_claims_created_at_time ON neftydrops_claims USING btree (created_at_time);

CREATE
    INDEX neftydrops_balances_owner ON neftydrops_balances USING btree (owner);

CREATE
    INDEX neftydrops_drop_assets_drop_id ON neftydrops_drop_assets USING btree (drop_id);
CREATE
    INDEX neftydrops_drop_assets_template_id ON neftydrops_drop_assets USING btree (template_id);
CREATE
    INDEX neftydrops_drop_assets_collection_name ON neftydrops_drop_assets USING btree (collection_name);

CREATE
    INDEX neftydrops_drops_alternate_prices_price ON neftydrops_drops_alternative_prices USING btree (price);
CREATE
    INDEX neftydrops_drops_alternate_prices_symbol ON neftydrops_drops_alternative_prices USING btree (symbol);

CREATE
    INDEX IF NOT EXISTS neftydrops_account_stats_claimer ON neftydrops_account_stats USING btree (claimer);
CREATE
    INDEX IF NOT EXISTS neftydrops_account_stats_drop_id ON neftydrops_account_stats USING btree (drop_id);
CREATE
    INDEX IF NOT EXISTS neftydrops_accounts_whitelist_drop_id ON neftydrops_accounts_whitelist USING btree (drop_id);
CREATE
    INDEX IF NOT EXISTS neftydrops_accounts_whitelist_account ON neftydrops_accounts_whitelist USING btree (account);
CREATE
    INDEX IF NOT EXISTS neftydrops_authkeys_drop_id ON neftydrops_authkeys USING btree (drop_id);
CREATE
    INDEX IF NOT EXISTS neftydrops_authkeys_public_key ON neftydrops_authkeys USING btree (public_key);
CREATE
    INDEX IF NOT EXISTS neftydrops_proof_of_ownership_filters_drop_id ON neftydrops_proof_of_ownership_filters USING btree (drop_id);
