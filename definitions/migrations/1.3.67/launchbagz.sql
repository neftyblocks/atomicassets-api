CREATE TABLE IF NOT EXISTS launchbagz_farms
(
    contract                character varying(13) NOT NULL,
    farm_name               character varying(13) NOT NULL,
    creator                 character varying(13),
    original_creator        character varying(13) NOT NULL,
    staking_token_contract  character varying(12) NOT NULL,
    staking_token_code      character varying(10) NOT NULL,
    staking_token_precision integer               NOT NULL,
    incentive_count       integer               NOT NULL,
    total_staked            bigint                NOT NULL,
    vesting_time            bigint                NOT NULL,
    updated_at_block        bigint                NOT NULL,
    updated_at_time         bigint                NOT NULL,
    created_at_block        bigint                NOT NULL,
    created_at_time         bigint                NOT NULL,
    CONSTRAINT launchbagz_farms_pkey PRIMARY KEY (contract, farm_name)
);

CREATE TABLE IF NOT EXISTS  launchbagz_farm_rewards
(
    contract                character varying(13) NOT NULL,
    farm_name               character varying(13) NOT NULL,
    id                      bigint                NOT NULL,
    period_start            bigint                NOT NULL,
    period_finish           bigint                NOT NULL,
    reward_rate             bigint                NOT NULL,
    rewards_duration        bigint                NOT NULL,
    reward_per_token_stored bigint                NOT NULL,
    reward_token_contract   character varying(12) NOT NULL,
    reward_token_code       character varying(10) NOT NULL,
    reward_token_precision  integer               NOT NULL,
    reward_pool             bigint                NOT NULL,
    total_rewards_paid_out  bigint                NOT NULL,
    CONSTRAINT launchbagz_farm_rewards_pkey PRIMARY KEY (contract, farm_name, id)
);

CREATE TABLE IF NOT EXISTS  launchbagz_farms_partners
(
    contract character varying(13) NOT NULL,
    partner  character varying(13) NOT NULL,
    CONSTRAINT launchbagz_farms_partners_pkey PRIMARY KEY (contract, partner)
);

ALTER TABLE ONLY launchbagz_farm_rewards
    DROP CONSTRAINT IF EXISTS launchbagz_farm_rewards_farm_fkey;

ALTER TABLE ONLY launchbagz_farm_rewards
    ADD CONSTRAINT launchbagz_farm_rewards_farm_fkey FOREIGN KEY (contract, farm_name) REFERENCES launchbagz_farms (contract, farm_name) MATCH SIMPLE ON
        UPDATE RESTRICT
        ON
            DELETE
            RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

CREATE
    INDEX IF NOT EXISTS  launchbagz_farms_staking_token_contract_code ON launchbagz_farms USING btree (staking_token_contract, staking_token_code);
CREATE
    INDEX IF NOT EXISTS launchbagz_farms_created_at_time ON launchbagz_farms USING btree (created_at_time);
CREATE
    INDEX IF NOT EXISTS launchbagz_farms_updated_at_time ON launchbagz_farms USING btree (updated_at_time);
CREATE
    INDEX IF NOT EXISTS launchbagz_farms_creator ON launchbagz_farms USING btree (creator);
CREATE
    INDEX IF NOT EXISTS launchbagz_farms_original_creator ON launchbagz_farms USING btree (original_creator);

CREATE
    INDEX IF NOT EXISTS launchbagz_farm_rewards_staking_token_contract_code ON launchbagz_farm_rewards USING btree (reward_token_contract, reward_token_code);
