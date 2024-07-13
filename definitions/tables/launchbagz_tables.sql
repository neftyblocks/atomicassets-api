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

CREATE TABLE launchbagz_farms
(
    contract                character varying(13) NOT NULL,
    farm_name               character varying(13) NOT NULL,
    creator                 character varying(13),
    original_creator        character varying(13) NOT NULL,
    staking_token_contract  character varying(12) NOT NULL,
    staking_token_code      character varying(10) NOT NULL,
    staking_token_precision integer               NOT NULL,
    incentive_count         integer               NOT NULL,
    total_staked            bigint                NOT NULL,
    vesting_time            bigint                NOT NULL,
    updated_at_block        bigint                NOT NULL,
    updated_at_time         bigint                NOT NULL,
    created_at_block        bigint                NOT NULL,
    created_at_time         bigint                NOT NULL,
    CONSTRAINT launchbagz_farms_pkey PRIMARY KEY (contract, farm_name)
);

CREATE TABLE launchbagz_farm_rewards
(
    contract                character varying(13) NOT NULL,
    farm_name               character varying(13) NOT NULL,
    id                      bigint                NOT NULL,
    period_start            bigint                NOT NULL,
    period_finish           bigint                NOT NULL,
    reward_rate             character varying(39) NOT NULL,
    rewards_duration        bigint                NOT NULL,
    reward_per_token_stored character varying(39) NOT NULL,
    reward_token_contract   character varying(12) NOT NULL,
    reward_token_code       character varying(10) NOT NULL,
    reward_token_precision  integer               NOT NULL,
    reward_pool             bigint                NOT NULL,
    total_rewards_paid_out  bigint                NOT NULL,
    CONSTRAINT launchbagz_farm_rewards_pkey PRIMARY KEY (contract, farm_name, id)
);

CREATE TABLE launchbagz_farm_stakers
(
    contract               character varying(13) NOT NULL,
    farm_name              character varying(13) NOT NULL,
    owner                  character varying(13) NOT NULL,
    balance                bigint                NOT NULL,
    vesting_end_time       bigint                NOT NULL,
    updated_at_time        bigint                NOT NULL,
    updated_at_block       bigint                NOT NULL,
    CONSTRAINT launchbagz_farm_stakers_pkey PRIMARY KEY (contract, farm_name, owner)
);

CREATE TABLE launchbagz_farms_partners
(
    contract character varying(13) NOT NULL,
    partner  character varying(13) NOT NULL,
    CONSTRAINT launchbagz_farms_partners_pkey PRIMARY KEY (contract, partner)
);

ALTER TABLE ONLY launchbagz_farm_rewards
    ADD CONSTRAINT launchbagz_farm_rewards_farm_fkey FOREIGN KEY (contract, farm_name) REFERENCES launchbagz_farms (contract, farm_name) MATCH SIMPLE ON
        UPDATE RESTRICT
        ON
            DELETE
            RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

ALTER TABLE ONLY launchbagz_farm_stakers
    ADD CONSTRAINT launchbagz_farm_stakers_farm_fkey FOREIGN KEY (contract, farm_name) REFERENCES launchbagz_farms (contract, farm_name) MATCH SIMPLE ON
        UPDATE RESTRICT
        ON
            DELETE
            RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

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
CREATE
    INDEX launchbagz_vestings_created_at_time ON launchbagz_vestings USING btree (created_at_time);
CREATE
    INDEX launchbagz_vestings_updated_at_time ON launchbagz_vestings USING btree (updated_at_time);
CREATE
    INDEX launchbagz_vestings_start_time ON launchbagz_vestings USING btree (start_time);
CREATE
    INDEX launchbagz_vestings_total_allocation ON launchbagz_vestings USING btree (total_allocation);

CREATE
    INDEX launchbagz_farms_staking_token_contract_code ON launchbagz_farms USING btree (staking_token_contract, staking_token_code);
CREATE
    INDEX launchbagz_farms_created_at_time ON launchbagz_farms USING btree (created_at_time);
CREATE
    INDEX launchbagz_farms_updated_at_time ON launchbagz_farms USING btree (updated_at_time);
CREATE
    INDEX launchbagz_farms_creator ON launchbagz_farms USING btree (creator);
CREATE
    INDEX launchbagz_farms_original_creator ON launchbagz_farms USING btree (original_creator);

CREATE
    INDEX launchbagz_farm_rewards_staking_token_contract_code ON launchbagz_farm_rewards USING btree (reward_token_contract, reward_token_code);

CREATE
    INDEX launchbagz_farm_stakers_owner ON launchbagz_farm_stakers USING btree (owner);
CREATE
    INDEX launchbagz_farm_stakers_updated_at_time ON launchbagz_farm_stakers USING btree (updated_at_time);
CREATE
    INDEX launchbagz_farm_stakers_vesting_end_time ON launchbagz_farm_stakers USING btree (vesting_end_time);
