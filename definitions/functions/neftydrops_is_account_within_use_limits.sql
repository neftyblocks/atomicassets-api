DROP FUNCTION IF EXISTS neftydrops_is_account_within_use_limits(account_name character varying(13), drop_id bigint, drop_account_limit bigint, drop_account_limit_cooldown bigint);
CREATE FUNCTION neftydrops_is_account_within_use_limits(
  IN _account_name character varying(13),
  IN _drop_id bigint,
  IN _drop_account_limit bigint,
  IN _drop_account_limit_cooldown bigint
)
    RETURNS bool
    LANGUAGE plpgsql
as
$$
declare
    _use_counter BIGINT := null;
    _last_claim_time BIGINT := null;
BEGIN

    if (_drop_account_limit=0) 
        then return true;
    end if;
    
    SELECT INTO _use_counter, _last_claim_time 
      use_counter,
      last_claim_time
    FROM neftydrops_account_stats acc_stats 
    WHERE
        acc_stats.drop_id = _drop_id 
        AND acc_stats.claimer = _account_name
        AND acc_stats.use_counter < _drop_account_limit;
    
    -- Means no row was found, which means the claimer hasn't done any claims ever
    if (_use_counter is null)
        then return true;
    end if;

    IF (drop_account_limit_cooldown=0) then 
        -- there is no cooldown, so just check claimer's _use_counter
        return _use_counter < drop_account_limit;
    else
        -- there is a cooldown, if the cooldown time has expired return true 
        -- right away if not check claimer's _use_counter
        return 
            (now - last_claim_time) > drop_account_limit_cooldown OR
            row.use_counter < drop_account_limit;
    END IF;
    
END;
$$;
