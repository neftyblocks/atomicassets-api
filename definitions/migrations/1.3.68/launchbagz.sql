CREATE TABLE IF NOT EXISTS launchbagz_farm_stakers
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

ALTER TABLE ONLY launchbagz_farm_stakers
    DROP CONSTRAINT IF EXISTS launchbagz_farm_stakers_farm_fkey;

ALTER TABLE ONLY launchbagz_farm_stakers
    ADD CONSTRAINT launchbagz_farm_stakers_farm_fkey FOREIGN KEY (contract, farm_name) REFERENCES launchbagz_farms (contract, farm_name) MATCH SIMPLE ON
        UPDATE RESTRICT
        ON
            DELETE
            RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

CREATE
    INDEX IF NOT EXISTS launchbagz_farm_stakers_owner ON launchbagz_farm_stakers USING btree (owner);
CREATE
    INDEX IF NOT EXISTS  launchbagz_farm_stakers_updated_at_time ON launchbagz_farm_stakers USING btree (updated_at_time);
CREATE
    INDEX IF NOT EXISTS  launchbagz_farm_stakers_vesting_end_time ON launchbagz_farm_stakers USING btree (vesting_end_time);
