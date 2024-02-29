CREATE TABLE IF NOT EXISTS helpers_favorite_collections
(
    owner                  character varying(12) NOT NULL,
    collection_name        character varying(13) NOT NULL,
    updated_at_block       bigint                NOT NULL,
    updated_at_time        bigint                NOT NULL,
    CONSTRAINT helpers_favorite_collections_pkey PRIMARY KEY (owner, collection_name)
);

CREATE TABLE IF NOT EXISTS helpers_contacts
(
    owner                  character varying(12) NOT NULL,
    contact                character varying(12) NOT NULL,
    updated_at_block       bigint                NOT NULL,
    updated_at_time        bigint                NOT NULL,
    CONSTRAINT helpers_contacts_pkey PRIMARY KEY (owner, contact)
);

CREATE
    INDEX IF NOT EXISTS helpers_favorite_collections_owner ON helpers_favorite_collections USING btree(owner);
CREATE
    INDEX IF NOT EXISTS helpers_favorite_collections_collection ON helpers_favorite_collections USING btree(collection_name);

CREATE
    INDEX IF NOT EXISTS helpers_contacts_owner ON helpers_contacts USING btree(owner);
CREATE
    INDEX IF NOT EXISTS helpers_contacts_contact ON helpers_contacts USING btree(contact);
