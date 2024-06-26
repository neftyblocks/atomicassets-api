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

CREATE TABLE launchbagz_vestings
(
    contract         character varying(13) NOT NULL,
    vesting_id       bigint                NOT NULL,
    recipient        character varying(12) NOT NULL,
    owner            character varying(12) NOT NULL,
    token_contract   character varying(12) NOT NULL,
    token_code       character varying(10) NOT NULL,
    token_precision  integer               NOT NULL,
    start_time       bigint                NOT NULL,
    last_claim_time  bigint                NOT NULL,
    total_claimed    bigint                NOT NULL,
    immediate_unlock bigint                NOT NULL,
    total_allocation bigint                NOT NULL,
    period_length    bigint                NOT NULL,
    total_periods    bigint                NOT NULL,
    description      text                  NOT NULL,
    is_active        boolean               NOT NULL DEFAULT TRUE,
    updated_at_block bigint                NOT NULL,
    updated_at_time  bigint                NOT NULL,
    created_at_block bigint                NOT NULL,
    created_at_time  bigint                NOT NULL,
    CONSTRAINT launchbagz_vestings_pkey PRIMARY KEY (contract, vesting_id)
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
CREATE
    INDEX launchbagz_tokens_tx_fee ON launchbagz_tokens USING btree (tx_fee);

CREATE
    INDEX launchbagz_vestings_token_contract_code ON launchbagz_vestings USING btree (token_contract, token_code);
CREATE
    INDEX launchbagz_vestings_recipient ON launchbagz_vestings USING btree (recipient);
CREATE
    INDEX launchbagz_vestings_owner ON launchbagz_vestings USING btree (owner);
CREATE
    INDEX launchbagz_vestings_active ON launchbagz_vestings USING btree (is_active);

