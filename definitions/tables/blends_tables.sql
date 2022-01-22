CREATE TABLE neftyblends_blends
(
    assets_contract   character varying(12) NOT NULL,
    contract          character varying(12) NOT NULL,
    collection_name   character varying(13) NOT NULL,
    blend_id          bigint                NOT NULL,
    start_time        bigint                NOT NULL,
    end_time          bigint                NOT NULL,
    max               bigint                NOT NULL,
    use_count         bigint                NOT NULL,
    ingredients_count integer               NOT NULL,
    display_data      text                  NOT NULL,
    updated_at_block  bigint                NOT NULL,
    updated_at_time   bigint                NOT NULL,
    created_at_block  bigint                NOT NULL,
    created_at_time   bigint                NOT NULL,
    CONSTRAINT neftyblends_blends_pkey PRIMARY KEY (contract, blend_id)
);

CREATE TABLE neftyblends_blend_ingredients
(
    assets_contract            character varying(12) NOT NULL,
    contract                   character varying(12) NOT NULL,
    blend_id                   bigint                NOT NULL,
    ingredient_collection_name character varying(13),
    template_id                bigint,
    schema_name                character varying(12),
    amount                     integer               NOT NULL,
    effect                     jsonb,
    ingredient_type            character varying(50) NOT NULL,
    total_attributes           integer               NOT NULL default 0,
    updated_at_block           bigint                NOT NULL,
    updated_at_time            bigint                NOT NULL,
    created_at_block           bigint                NOT NULL,
    created_at_time            bigint                NOT NULL,
    ingredient_index           integer               NOT NULL,
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