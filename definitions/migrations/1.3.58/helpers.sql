CREATE TABLE IF NOT EXISTS helpers_collection_tags
(
    collection_name        character varying(13) NOT NULL,
    tag                    character varying(30) NOT NULL,
    updated_at_block       bigint                NOT NULL,
    updated_at_time        bigint                NOT NULL,
    CONSTRAINT helpers_collection_tags_pkey PRIMARY KEY (collection_name, tag)
);

-- Indexes
CREATE
    INDEX IF NOT EXISTS helpers_collection_tags_tag ON helpers_collection_tags USING btree(tag);
CREATE
    INDEX IF NOT EXISTS helpers_collection_tags_collection ON helpers_collection_tags USING btree(collection_name);
