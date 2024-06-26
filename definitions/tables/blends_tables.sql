CREATE TABLE neftyblends_blends
(
    assets_contract        character varying(12) NOT NULL,
    contract               character varying(12) NOT NULL,
    collection_name        character varying(13) NOT NULL,
    blend_id               bigint                NOT NULL,
    start_time             bigint                NOT NULL,
    end_time               bigint                NOT NULL,
    max                    bigint                NOT NULL,
    use_count              bigint                NOT NULL,
    account_limit          bigint                NOT NULL DEFAULT 0,
    account_limit_cooldown bigint                NOT NULL DEFAULT 0,
    ingredients_count      integer               NOT NULL,
    display_data           text                  NOT NULL,
    updated_at_block       bigint                NOT NULL,
    updated_at_time        bigint                NOT NULL,
    created_at_block       bigint                NOT NULL,
    created_at_time        bigint                NOT NULL,
    security_id            bigint                NOT NULL,
    is_hidden              boolean               NOT NULL DEFAULT FALSE,
    CONSTRAINT neftyblends_blends_pkey PRIMARY KEY (contract, blend_id)
);

CREATE TABLE neftyblends_blend_ingredients
(
    assets_contract                   character varying(12) NOT NULL,
    contract                          character varying(12) NOT NULL,
    blend_id                          bigint                NOT NULL,
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
    CONSTRAINT neftyblends_blend_ingredients_pkey PRIMARY KEY (contract, blend_id, ingredient_index)
);

CREATE TABLE neftyblends_blend_ingredient_attributes
(
    assets_contract            character varying(12) NOT NULL,
    contract                   character varying(12) NOT NULL,
    blend_id                   bigint                NOT NULL,
    ingredient_collection_name character varying(13) NOT NULL,
    ingredient_index           integer               NOT NULL,
    attribute_index            integer               NOT NULL,
    attribute_name             text                  NOT NULL,
    allowed_values             text[]                NOT NULL,
    CONSTRAINT neftyblends_blend_ingredient_attributes_pkey PRIMARY KEY (contract, blend_id, ingredient_index, attribute_index)
);

CREATE TABLE neftyblends_blend_rolls
(
    assets_contract character varying(12) NOT NULL,
    contract        character varying(12) NOT NULL,
    blend_id        bigint                NOT NULL,
    total_odds      bigint                NOT NULL,
    roll_index      integer               NOT NULL,
    CONSTRAINT neftyblends_blend_rolls_pkey PRIMARY KEY (contract, blend_id, roll_index)
);

CREATE TABLE neftyblends_blend_roll_outcomes
(
    assets_contract character varying(12) NOT NULL,
    contract        character varying(12) NOT NULL,
    blend_id        bigint                NOT NULL,
    roll_index      bigint                NOT NULL,
    odds            bigint                NOT NULL,
    outcome_index   integer               NOT NULL,
    CONSTRAINT neftyblends_blend_roll_outcomes_pkey PRIMARY KEY (contract, blend_id, roll_index, outcome_index)
);

CREATE TABLE neftyblends_blend_roll_outcome_results
(
    assets_contract character varying(12) NOT NULL,
    contract        character varying(12) NOT NULL,
    blend_id        bigint                NOT NULL,
    roll_index      bigint                NOT NULL,
    outcome_index   integer               NOT NULL,
    payload         jsonb                 NOT NULL,
    type            character varying(50) NOT NULL,
    result_index    integer               NOT NULL,
    CONSTRAINT neftyblends_blend_roll_outcome_results_pkey PRIMARY KEY (contract, blend_id,
                                                                        roll_index, outcome_index,
                                                                        result_index)
);

CREATE TABLE neftyblends_config
(
    contract      character varying(12) NOT NULL,
    fee           double precision      NOT NULL,
    fee_recipient character varying(12) NOT NULL,
    CONSTRAINT neftyblends_config_pkey PRIMARY KEY (contract)
);

CREATE TABLE neftyblends_tokens
(
    contract        character varying(12) NOT NULL,
    token_contract  character varying(12) NOT NULL,
    token_symbol    character varying(12) NOT NULL,
    token_precision integer               NOT NULL,
    CONSTRAINT neftyblends_tokens_pkey PRIMARY KEY (contract, token_symbol)
);

CREATE TABLE neftyblends_fusions
(
    claim_id           bigint                NOT NULL,
    contract           character varying(13) NOT NULL,
    claimer            character varying(12) NOT NULL,
    blend_id           bigint                NOT NULL,
    results            jsonb,
    transferred_assets bigint[],
    own_assets         bigint[],
    txid               bytea                 NOT NULL,
    created_at_block   bigint                NOT NULL,
    created_at_time    bigint                NOT NULL,
    updated_at_block   bigint                NOT NULL,
    updated_at_time    bigint                NOT NULL,
    CONSTRAINT neftyblends_fusion_pkey PRIMARY KEY (contract, claim_id)
);

ALTER TABLE ONLY neftyblends_blend_ingredients
    ADD CONSTRAINT neftyblends_blend_ingredients_blend_fkey FOREIGN KEY (contract, blend_id) REFERENCES neftyblends_blends (contract, blend_id) MATCH SIMPLE ON
        UPDATE RESTRICT
        ON
            DELETE
            RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

ALTER TABLE ONLY neftyblends_blend_rolls
    ADD CONSTRAINT neftyblends_blend_rolls_blend_fkey FOREIGN KEY (contract, blend_id) REFERENCES neftyblends_blends (contract, blend_id) MATCH SIMPLE ON
        UPDATE RESTRICT
        ON
            DELETE
            RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

ALTER TABLE ONLY neftyblends_blend_roll_outcomes
    ADD CONSTRAINT neftyblends_blend_roll_outcomes_blend_fkey FOREIGN KEY (contract, blend_id, roll_index) REFERENCES neftyblends_blend_rolls (contract, blend_id, roll_index) MATCH SIMPLE ON
        UPDATE RESTRICT
        ON
            DELETE
            RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

ALTER TABLE ONLY neftyblends_blend_roll_outcome_results
    ADD CONSTRAINT neftyblends_blend_roll_outcome_results_blend_fkey FOREIGN KEY (contract, blend_id, roll_index, outcome_index) REFERENCES neftyblends_blend_roll_outcomes (contract, blend_id, roll_index, outcome_index) MATCH SIMPLE ON
        UPDATE RESTRICT
        ON
            DELETE
            RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

ALTER TABLE ONLY neftyblends_blend_ingredient_attributes
    ADD CONSTRAINT neftyblends_blend_ingredient_attributes_blend_ingredient_fkey FOREIGN KEY (contract, blend_id, ingredient_index) REFERENCES neftyblends_blend_ingredients (contract, blend_id, ingredient_index) MATCH SIMPLE ON
        UPDATE RESTRICT
        ON
            DELETE
            RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

-- Indexes
CREATE
    INDEX neftyblends_blends_contract_collection_name ON neftyblends_blends USING btree (contract, collection_name);
CREATE
    INDEX neftyblends_blends_collection_name ON neftyblends_blends USING btree (collection_name);
CREATE
    INDEX neftyblends_blends_start_time ON neftyblends_blends USING btree (start_time);
CREATE
    INDEX neftyblends_blends_end_time ON neftyblends_blends USING btree (end_time);
CREATE
    INDEX neftyblends_blends_created_at_time ON neftyblends_blends USING btree (created_at_time);
CREATE
    INDEX neftyblends_blends_updated_at_time ON neftyblends_blends USING btree (updated_at_time);

CREATE
    INDEX neftyblends_blend_ingredients_template_id ON neftyblends_blend_ingredients USING btree (contract, template_id);
CREATE
    INDEX neftyblends_blend_ingredients_schema_name ON neftyblends_blend_ingredients USING btree (contract, schema_name);
CREATE
    INDEX neftyblends_blend_ingredients_collection_name ON neftyblends_blends USING btree (collection_name);

CREATE
    INDEX neftyblends_blend_roll_outcome_result_type ON neftyblends_blend_roll_outcome_results USING btree (contract, type);
CREATE
    INDEX neftyblends_blend_roll_outcome_result_payload ON neftyblends_blend_roll_outcome_results USING gin (payload);

CREATE
    INDEX neftyblends_blend_ingredient_attributes_ingredient_index ON neftyblends_blend_ingredient_attributes USING btree (contract, blend_id, ingredient_index);
CREATE
    INDEX neftyblends_blend_ingredient_attributes_attribute_name ON neftyblends_blend_ingredient_attributes USING btree (contract, attribute_name);
CREATE
    INDEX neftyblends_blend_ingredient_attributes_allowed_values ON neftyblends_blend_ingredient_attributes USING gin (allowed_values);
CREATE
    INDEX neftyblends_blend_ingredient_attributes_ingredient_collection ON neftyblends_blend_ingredient_attributes USING btree (ingredient_collection_name);

CREATE
    INDEX neftyblends_blend_ingredients_type ON neftyblends_blend_ingredients USING btree (ingredient_type);
CREATE
    INDEX neftyblends_blend_roll_outcome_results_type ON neftyblends_blend_roll_outcome_results USING btree ("type");

CREATE
    INDEX neftyblends_fusion_created_at_time ON neftyblends_fusions USING btree (created_at_time);
CREATE
    INDEX neftyblends_fusion_updated_at_time ON neftyblends_fusions USING btree (updated_at_time);
CREATE
    INDEX neftyblends_fusion_claimer ON neftyblends_fusions USING btree (claimer);
CREATE
    INDEX neftyblends_fusion_txid ON neftyblends_fusions USING hash (txid);

