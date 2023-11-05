CREATE TABLE neftypacks_packs
(
    assets_contract  character varying(12) NOT NULL,
    contract         character varying(12) NOT NULL,
    collection_name  character varying(13) NOT NULL,
    pack_id          bigint                NOT NULL,
    recipe_id        bigint                NOT NULL,
    unlock_time      bigint                NOT NULL,
    use_count        bigint                NOT NULL,
    pack_template_id bigint                NOT NULL,
    display_data     text                  NOT NULL,
    updated_at_block bigint                NOT NULL,
    updated_at_time  bigint                NOT NULL,
    created_at_block bigint                NOT NULL,
    created_at_time  bigint                NOT NULL,
    CONSTRAINT neftypacks_packs_pkey PRIMARY KEY (contract, pack_id)
);

-- Indexes
CREATE
    INDEX neftypacks_packs_contract_collection_name ON neftypacks_packs USING btree (contract, collection_name);
CREATE
    INDEX neftypacks_packs_collection_name ON neftypacks_packs USING btree (collection_name);
CREATE
    INDEX neftypacks_packs_unlock_time ON neftypacks_packs USING btree (unlock_time);
CREATE
    INDEX neftypacks_packs_created_at_time ON neftypacks_packs USING btree (created_at_time);
CREATE
    INDEX neftypacks_packs_updated_at_time ON neftypacks_packs USING btree (updated_at_time);
CREATE
    INDEX neftypacks_packs_pack_template_id ON neftypacks_packs USING btree (pack_template_id);

