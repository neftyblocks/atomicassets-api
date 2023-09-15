DROP VIEW IF EXISTS neftyblends_blend_details_master;
DROP FUNCTION IF EXISTS neftyblends_blend_details_func;

ALTER TABLE neftyblends_blends
    ADD COLUMN IF NOT EXISTS account_limit bigint NOT NULL DEFAULT 0;
ALTER TABLE neftyblends_blends
    ADD COLUMN IF NOT EXISTS account_limit_cooldown bigint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS neftyblends_fusions
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

CREATE
    INDEX IF NOT EXISTS neftyblends_fusion_created_at_time ON neftyblends_fusions USING btree (created_at_time);
CREATE
    INDEX IF NOT EXISTS neftyblends_fusion_updated_at_time ON neftyblends_fusions USING btree (updated_at_time);
CREATE
    INDEX IF NOT EXISTS neftyblends_fusion_claimer ON neftyblends_fusions USING btree (claimer);
CREATE
    INDEX IF NOT EXISTS neftyblends_fusion_txid ON neftyblends_fusions USING hash (txid);
