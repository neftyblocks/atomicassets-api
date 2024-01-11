CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE TABLE neftyupgrades_upgrades
(
    contract          character varying(12)  NOT NULL,
    collection_name   character varying(13)  NOT NULL,
    upgrade_id        bigint                 NOT NULL,
    start_time        bigint                 NOT NULL,
    end_time          bigint                 NOT NULL,
    max               bigint                 NOT NULL,
    use_count         bigint                 NOT NULL,
    ingredients_count integer                NOT NULL,
    display_data      text                   NOT NULL,
    updated_at_block  bigint                 NOT NULL,
    updated_at_time   bigint                 NOT NULL,
    created_at_block  bigint                 NOT NULL,
    created_at_time   bigint                 NOT NULL,
    security_id       bigint                 NOT NULL,
    is_hidden         boolean                NOT NULL DEFAULT FALSE,
    category          character varying(255) NOT NULL DEFAULT '',
    name              TEXT                   NOT NULL DEFAULT '',
    is_available      boolean GENERATED ALWAYS AS (
                          CASE
                              WHEN max = 0 THEN true
                              ELSE (max - use_count) > 0
                              END
                          ) STORED,
    CONSTRAINT neftyupgrades_upgrades_pkey PRIMARY KEY (contract, upgrade_id)
);

CREATE TABLE neftyupgrades_upgrade_ingredients
(
    contract                          character varying(12) NOT NULL,
    upgrade_id                        bigint                NOT NULL,
    ingredient_collection_name        character varying(13),
    template_id                       bigint,
    schema_name                       character varying(12),
    balance_ingredient_attribute_name text,
    balance_ingredient_cost           numeric,
    ft_ingredient_quantity_price      bigint,
    ft_ingredient_quantity_symbol     character varying(12),
    amount                            integer               NOT NULL,
    effect                            jsonb,
    ingredient_type                   character varying(50) NOT NULL,
    total_attributes                  integer               NOT NULL default 0,
    updated_at_block                  bigint                NOT NULL,
    updated_at_time                   bigint                NOT NULL,
    created_at_block                  bigint                NOT NULL,
    created_at_time                   bigint                NOT NULL,
    ingredient_index                  integer               NOT NULL,
    display_data                      text,
    CONSTRAINT neftyupgrades_upgrade_ingredients_pkey PRIMARY KEY (contract, upgrade_id, ingredient_index)
);

CREATE TABLE neftyupgrades_upgrade_ingredient_attributes
(
    contract                   character varying(12) NOT NULL,
    upgrade_id                 bigint                NOT NULL,
    ingredient_collection_name character varying(13) NOT NULL,
    ingredient_index           integer               NOT NULL,
    attribute_index            integer               NOT NULL,
    attribute_name             text                  NOT NULL,
    allowed_values             text[]                NOT NULL,
    CONSTRAINT neftyupgrades_upgrade_ingredient_attributes_pkey PRIMARY KEY (contract, upgrade_id, ingredient_index, attribute_index)
);

CREATE TABLE neftyupgrades_upgrade_ingredient_typed_attributes
(
    contract                   character varying(12) NOT NULL,
    upgrade_id                 bigint                NOT NULL,
    ingredient_collection_name character varying(13) NOT NULL,
    ingredient_index           integer               NOT NULL,
    attribute_index            integer               NOT NULL,
    attribute_name             text                  NOT NULL,
    attribute_type             text                  NOT NULL,
    allowed_values_type        text                  NOT NULL,
    allowed_values             jsonb                 NOT NULL,

    CONSTRAINT neftyupgrades_upgrade_ingredient_typed_attributes_pkey PRIMARY KEY (contract, upgrade_id, ingredient_index, attribute_index)
);

CREATE TABLE neftyupgrades_upgrade_specs
(
    contract     character varying(12) NOT NULL,
    upgrade_id   bigint                NOT NULL,
    spec_index   bigint                NOT NULL,
    schema_name  character varying(12) NOT NULL,
    display_data text DEFAULT '',
    CONSTRAINT neftyupgrades_upgrade_specs_pkey PRIMARY KEY (contract, upgrade_id, spec_index)
);

CREATE TABLE neftyupgrades_upgrade_specs_requirements
(
    contract            character varying(12) NOT NULL,
    upgrade_id          bigint                NOT NULL,
    spec_index          bigint                NOT NULL,
    requirement_index   bigint                NOT NULL,
    requirement_type    character varying(50) NOT NULL,
    requirement_payload jsonb                 NOT NULL,
    CONSTRAINT neftyupgrades_upgrade_specs_requirements_pkey PRIMARY KEY (contract, upgrade_id, spec_index, requirement_index)
);

CREATE TABLE neftyupgrades_upgrade_specs_results
(
    contract       character varying(12) NOT NULL,
    upgrade_id     bigint                NOT NULL,
    spec_index     bigint                NOT NULL,
    result_index   bigint                NOT NULL,
    attribute_name character varying(12) NOT NULL,
    attribute_type character varying(50) NOT NULL,
    operator_type  integer               NOT NULL,
    value_type     character varying(50) NOT NULL,
    value          jsonb                 NOT NULL,
    CONSTRAINT neftyupgrades_upgrade_specs_results_pkey PRIMARY KEY (contract, upgrade_id, spec_index, result_index)
);

CREATE TABLE neftyupgrades_config
(
    contract      character varying(12) NOT NULL,
    fee           double precision      NOT NULL,
    fee_recipient character varying(12) NOT NULL,
    CONSTRAINT neftyupgrades_config_pkey PRIMARY KEY (contract)
);

CREATE TABLE neftyupgrades_tokens
(
    contract        character varying(12) NOT NULL,
    token_contract  character varying(12) NOT NULL,
    token_symbol    character varying(12) NOT NULL,
    token_precision integer               NOT NULL,
    CONSTRAINT neftyupgrades_tokens_pkey PRIMARY KEY (contract, token_symbol)
);

CREATE TABLE neftyupgrades_claims
(
    claim_id           bigint                NOT NULL,
    contract           character varying(13) NOT NULL,
    claimer            character varying(12) NOT NULL,
    upgrade_id         bigint                NOT NULL,
    mutations          jsonb,
    transferred_assets bigint[],
    own_assets         bigint[],
    txid               bytea                 NOT NULL,
    created_at_block   bigint                NOT NULL,
    created_at_time    bigint                NOT NULL,
    updated_at_block   bigint                NOT NULL,
    updated_at_time    bigint                NOT NULL,
    CONSTRAINT neftyupgrades_claim_pkey PRIMARY KEY (contract, claim_id)
);

ALTER TABLE ONLY neftyupgrades_upgrade_ingredients
    ADD CONSTRAINT neftyupgrades_upgrade_ingredients_upgrade_fkey FOREIGN KEY (contract, upgrade_id) REFERENCES neftyupgrades_upgrades (contract, upgrade_id) MATCH SIMPLE ON
        UPDATE RESTRICT
        ON
            DELETE
            RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

ALTER TABLE ONLY neftyupgrades_upgrade_ingredient_attributes
    ADD CONSTRAINT neftyupgrades_upgrade_ingredient_attributes_ingredient_fkey FOREIGN KEY (contract, upgrade_id, ingredient_index) REFERENCES neftyupgrades_upgrade_ingredients (contract, upgrade_id, ingredient_index) MATCH SIMPLE ON
        UPDATE RESTRICT
        ON
            DELETE
            RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

ALTER TABLE ONLY neftyupgrades_upgrade_ingredient_typed_attributes
    ADD CONSTRAINT neftyupgrades_upgrade_ingredient_typed_attr_ingredient_fkey
        FOREIGN KEY (
                     contract, upgrade_id, ingredient_index)
            REFERENCES neftyupgrades_upgrade_ingredients (
                                                          contract, upgrade_id, ingredient_index
                ) MATCH SIMPLE ON
            UPDATE RESTRICT
            ON
                DELETE
                RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

ALTER TABLE ONLY neftyupgrades_upgrade_specs
    ADD CONSTRAINT neftyupgrades_upgrade_specs_upgrade_fkey
        FOREIGN KEY (
                     contract, upgrade_id
            ) REFERENCES neftyupgrades_upgrades (
                                                 contract, upgrade_id
            ) MATCH SIMPLE ON
            UPDATE RESTRICT
            ON
                DELETE
                RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

ALTER TABLE ONLY neftyupgrades_upgrade_specs_requirements
    ADD CONSTRAINT neftyupgrades_upgrade_spec_upgrade_requirements_specs_fkey
        FOREIGN KEY (
                     contract, upgrade_id, spec_index
            ) REFERENCES neftyupgrades_upgrade_specs (
                                                      contract, upgrade_id, spec_index
            ) MATCH SIMPLE ON
            UPDATE RESTRICT
            ON
                DELETE
                RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

ALTER TABLE ONLY neftyupgrades_upgrade_specs_results
    ADD CONSTRAINT neftyupgrades_upgrade_spec_upgrade_results_specs_fkey
        FOREIGN KEY (
                     contract, upgrade_id, spec_index
            ) REFERENCES neftyupgrades_upgrade_specs (
                                                      contract, upgrade_id, spec_index
            ) MATCH SIMPLE ON
            UPDATE RESTRICT
            ON
                DELETE
                RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

-- Indexes
CREATE
    INDEX neftyupgrades_upgrades_contract_collection_name ON neftyupgrades_upgrades USING btree (contract, collection_name);
CREATE
    INDEX neftyupgrades_upgrades_collection_name ON neftyupgrades_upgrades USING btree (collection_name);
CREATE
    INDEX neftyupgrades_upgrades_start_time ON neftyupgrades_upgrades USING btree (start_time);
CREATE
    INDEX neftyupgrades_upgrades_end_time ON neftyupgrades_upgrades USING btree (end_time);
CREATE
    INDEX neftyupgrades_upgrades_created_at_time ON neftyupgrades_upgrades USING btree (created_at_time);
CREATE
    INDEX neftyupgrades_upgrades_updated_at_time ON neftyupgrades_upgrades USING btree (updated_at_time);

CREATE
    INDEX neftyupgrades_upgrade_ingredients_template_id ON neftyupgrades_upgrade_ingredients USING btree (contract, template_id);
CREATE
    INDEX neftyupgrades_upgrade_ingredients_schema_name ON neftyupgrades_upgrade_ingredients USING btree (contract, schema_name);
CREATE
    INDEX neftyupgrades_upgrade_ingredients_collection_name ON neftyupgrades_upgrades USING btree (collection_name);

CREATE
    INDEX neftyupgrades_upgrade_ingredient_attributes_ingredient_index ON neftyupgrades_upgrade_ingredient_attributes USING btree (contract, upgrade_id, ingredient_index);
CREATE
    INDEX neftyupgrades_upgrade_ingredient_attributes_attribute_name ON neftyupgrades_upgrade_ingredient_attributes USING btree (contract, attribute_name);
CREATE
    INDEX neftyupgrades_upgrade_ingredient_attributes_allowed_values ON neftyupgrades_upgrade_ingredient_attributes USING gin (allowed_values);
CREATE
    INDEX neftyupgrades_upgrade_ingredient_attributes_collection ON neftyupgrades_upgrade_ingredient_attributes USING btree (ingredient_collection_name);

CREATE
    INDEX neftyupgrades_upgrade_ingredients_type ON neftyupgrades_upgrade_ingredients USING btree (ingredient_type);


CREATE
    INDEX neftyupgrades_upgrade_is_available ON neftyupgrades_upgrades USING btree (is_available);

CREATE
    INDEX neftyupgrades_upgrade_name ON neftyupgrades_upgrades USING gist ((name) gist_trgm_ops);

CREATE
    INDEX neftyupgrades_claim_created_at_time ON neftyupgrades_claims USING btree (created_at_time);
CREATE
    INDEX neftyupgrades_claim_updated_at_time ON neftyupgrades_claims USING btree (updated_at_time);
CREATE
    INDEX neftyupgrades_claim_claimer ON neftyupgrades_claims USING btree (claimer);
CREATE
    INDEX neftyupgrades_claim_txid ON neftyupgrades_claims USING hash (txid);
