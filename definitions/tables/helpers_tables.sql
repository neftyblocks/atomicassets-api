CREATE TABLE helpers_collection_list
(
    assets_contract        character varying(12) NOT NULL,
    collection_name        character varying(13) NOT NULL,
    contract               character varying(12) NOT NULL,
    list                   character varying(12) NOT NULL,
    updated_at_block       bigint                NOT NULL,
    updated_at_time        bigint                NOT NULL,
    CONSTRAINT helpers_collection_list_pkey PRIMARY KEY (assets_contract, collection_name, contract, list)
);

CREATE TABLE helpers_collection_tags
(
    collection_name        character varying(13) NOT NULL,
    tag                    character varying(30) NOT NULL,
    updated_at_block       bigint                NOT NULL,
    updated_at_time        bigint                NOT NULL,
    CONSTRAINT helpers_collection_tags_pkey PRIMARY KEY (collection_name, tag)
);

-- Indexes
CREATE
    INDEX helpers_list_collection_name ON helpers_collection_list USING btree(collection_name);
CREATE
    INDEX helpers_list_assets_contract_collection_name ON helpers_collection_list USING btree(assets_contract, collection_name);
CREATE
    INDEX helpers_list_assets_contract_collection_name_list ON helpers_collection_list USING btree(assets_contract, collection_name, list);
CREATE
    INDEX helpers_list_assets_contract_list_provider ON helpers_collection_list USING btree(assets_contract, list, contract);

CREATE
    INDEX helpers_collection_tags_tag ON helpers_collection_tags USING btree(tag);
CREATE
    INDEX helpers_collection_tags_collection ON helpers_collection_tags USING btree(collection_name);
