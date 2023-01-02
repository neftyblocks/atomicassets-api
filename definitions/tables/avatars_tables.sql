CREATE TABLE neftyavatars_blends
(
    collection_name  character varying(13) NOT NULL,
    blend_id         bigint                NOT NULL,
    start_time       bigint                NOT NULL,
    end_time         bigint                NOT NULL,
    max              bigint                NOT NULL,
    use_count        bigint                NOT NULL,
    lock_count       bigint                NOT NULL,
    display_data     text                  NOT NULL,
    base_template_id bigint                NOT NULL,
    lock_schema_name character varying(13) NOT NULL,
    accessory_specs  jsonb                 NOT NULL,
    updated_at_block bigint                NOT NULL,
    updated_at_time  bigint                NOT NULL,
    created_at_block bigint                NOT NULL,
    created_at_time  bigint                NOT NULL,
    CONSTRAINT neftyavatars_blends_pkey PRIMARY KEY (blend_id)
);

CREATE TABLE neftyavatars_pfps
(
    asset_id         bigint                NOT NULL,
    owner            character varying(13) NOT NULL,
    CONSTRAINT neftyavatars_pfps_pkey PRIMARY KEY (owner)
);

-- Indexes
CREATE
    INDEX neftyavatars_blends_collection_name ON neftyavatars_blends USING btree (collection_name);
CREATE
    INDEX neftyavatars_blends_start_time ON neftyavatars_blends USING btree (start_time);
CREATE
    INDEX neftyavatars_blends_end_time ON neftyavatars_blends USING btree (end_time);
CREATE
    INDEX neftyavatars_blends_created_at_time ON neftyavatars_blends USING btree (created_at_time);
CREATE
    INDEX neftyavatars_blends_updated_at_time ON neftyavatars_blends USING btree (updated_at_time);
CREATE
    INDEX neftyavatars_blends_base_template_id ON neftyavatars_blends USING btree (base_template_id);


