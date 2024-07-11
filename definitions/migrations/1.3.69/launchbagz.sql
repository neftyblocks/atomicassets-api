TRUNCATE TABLE launchbagz_stakers;
TRUNCATE TABLE launchbagz_farm_rewards;
TRUNCATE TABLE launchbagz_farms_partners;
TRUNCATE TABLE launchbagz_farms;

ALTER TABLE launchbagz_farm_rewards DROP COLUMN reward_rate;
ALTER TABLE launchbagz_farm_rewards DROP COLUMN reward_per_token_stored;

ALTER TABLE launchbagz_farm_rewards ADD COLUMN reward_rate character varying(39) NOT NULL;
ALTER TABLE launchbagz_farm_rewards ADD COLUMN reward_per_token_stored character varying(39) NOT NULL;
