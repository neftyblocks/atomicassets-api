CREATE TABLE launchbagz_launches
(
    contract            character varying(12)   NOT NULL,
    launch_id           bigint                  NOT NULL,
    token_contract      character varying(12)   NOT NULL,
    token_code          character varying(10)   NOT NULL,
    token_precision     integer                 NOT NULL,
    display_data        jsonb                   NOT NULL,
    updated_at_block    bigint                  NOT NULL,
    updated_at_time     bigint                  NOT NULL,
    created_at_block    bigint                  NOT NULL,
    created_at_time     bigint                  NOT NULL,
    is_hidden           boolean                 NOT NULL DEFAULT FALSE,
    authorized_accounts character varying(12)[] NOT NULL DEFAULT '{}'::character varying[],
    blend_contract      character varying(12),
    blend_id            bigint,
    CONSTRAINT launchbagz_launches_pkey PRIMARY KEY (contract, launch_id)
);

CREATE TABLE launchbagz_tokens
(
    contract         character varying(12) NOT NULL,
    token_contract   character varying(12) NOT NULL,
    token_code       character varying(10) NOT NULL,
    tx_fee           double precision      NOT NULL DEFAULT 0.0,
    image            text                  NOT NULL,
    updated_at_block bigint                NOT NULL,
    updated_at_time  bigint                NOT NULL,
    created_at_block bigint                NOT NULL,
    created_at_time  bigint                NOT NULL,
    CONSTRAINT launchbagz_tokens_pkey PRIMARY KEY (contract, token_contract, token_code)
);

-- Indexes
CREATE
    INDEX launchbagz_launches_token_contract_code ON launchbagz_launches USING btree (token_contract, token_code);
CREATE
    INDEX launchbagz_launches_created_at_time ON launchbagz_launches USING btree (created_at_time);
CREATE
    INDEX launchbagz_launches_updated_at_time ON launchbagz_launches USING btree (updated_at_time);

CREATE
    INDEX launchbagz_tokens_token_contract_code ON launchbagz_tokens USING btree (token_contract, token_code);
CREATE
    INDEX launchbagz_tokens_created_at_time ON launchbagz_tokens USING btree (created_at_time);
CREATE
    INDEX launchbagz_tokens_updated_at_time ON launchbagz_tokens USING btree (updated_at_time);

