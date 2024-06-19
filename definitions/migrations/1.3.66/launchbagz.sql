CREATE TABLE IF NOT EXISTS launchbagz_vestings
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

CREATE
    INDEX IF NOT EXISTS launchbagz_vestings_token_contract_code ON launchbagz_vestings USING btree (token_contract, token_code);
CREATE
    INDEX IF NOT EXISTS launchbagz_vestings_recipient ON launchbagz_vestings USING btree (recipient);
CREATE
    INDEX IF NOT EXISTS launchbagz_vestings_owner ON launchbagz_vestings USING btree (owner);
CREATE
    INDEX IF NOT EXISTS launchbagz_vestings_active ON launchbagz_vestings USING btree (is_active);
