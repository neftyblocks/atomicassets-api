CREATE OR REPLACE VIEW launchbagz_farms_master AS
SELECT DISTINCT
    ON (contract, farm_name) f.contract,
                             f.farm_name,
                             f.creator,
                             f.original_creator,

                             json_build_object(
                                     'token_contract', f.staking_token_contract,
                                     'token_symbol', f.staking_token_code,
                                     'token_precision', f.staking_token_precision
                                 )                                 staking_token,
                             f.total_staked,
                             f.vesting_time,
                             COALESCE(rewards.rewards, '[]'::json) rewards,

                             f.updated_at_block,
                             f.updated_at_time,
                             f.created_at_block,
                             f.created_at_time
FROM launchbagz_farms f
         LEFT JOIN LATERAL (
    SELECT JSON_AGG(
                   JSON_BUILD_OBJECT(
                           'id', id,
                           'period_start', period_start,
                           'period_finish', period_finish,
                           'reward_rate', reward_rate,
                           'reward_duration', rewards_duration,
                           'reward_per_token_stored', reward_per_token_stored,
                           'token', JSON_BUILD_OBJECT(
                                   'token_contract', reward_token_contract,
                                   'token_symbol', reward_token_code,
                                   'token_precision', reward_token_precision
                               ),
                           'reward_pool', reward_pool,
                           'total_rewards_paid_out', total_rewards_paid_out
                       )
               ) rewards
    from launchbagz_farm_rewards fr
    WHERE fr.contract = f.contract
      AND fr.farm_name = f.farm_name
    ) as rewards ON true
