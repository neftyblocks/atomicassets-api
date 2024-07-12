DROP VIEW launchbagz_farms_master;
TRUNCATE TABLE launchbagz_farm_stakers CASCADE;
TRUNCATE TABLE launchbagz_farm_rewards CASCADE;
TRUNCATE TABLE launchbagz_farms_partners CASCADE;
TRUNCATE TABLE launchbagz_farms CASCADE;

ALTER TABLE launchbagz_farm_rewards DROP COLUMN reward_rate;
ALTER TABLE launchbagz_farm_rewards DROP COLUMN reward_per_token_stored;

ALTER TABLE launchbagz_farm_rewards ADD COLUMN reward_rate character varying(39) NOT NULL;
ALTER TABLE launchbagz_farm_rewards ADD COLUMN reward_per_token_stored character varying(39) NOT NULL;
