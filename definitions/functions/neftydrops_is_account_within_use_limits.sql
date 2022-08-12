DROP FUNCTION IF EXISTS neftydrops_is_account_within_use_limits(
    _account_name character varying(13),
    _account_use_counter bigint,
    _account_last_claim_time bigint,
    _drop_id bigint,
    _drop_account_limit bigint,
    _drop_account_limit_cooldown bigint
);

CREATE FUNCTION neftydrops_is_account_within_use_limits(
  IN _account_name character varying(13),
  IN _account_use_counter bigint,
  IN _account_last_claim_time bigint,
  IN _drop_id bigint,
  IN _drop_account_limit bigint,
  IN _drop_account_limit_cooldown bigint
)
    RETURNS bool
    LANGUAGE plpgsql
as
$$
BEGIN

    if (_drop_account_limit=0) 
        then return true;
    end if;
    
    -- means there is no entry in account_stats tables, which means 0 uses for
    -- that account
    if (_account_use_counter is null)
        then return true;
    end if;

    IF (drop_account_limit_cooldown=0) then 
        -- there is no cooldown, so just check claimer's _use_counter
        return _account_use_counter < _drop_account_limit;
    else
        -- there is a cooldown, if the cooldown time has expired return true 
        -- right away if not check claimer's _use_counter
        return 
            ((cast(extract(epoch from now()) as bigint) * 1000) - _account_last_claim_time) > drop_account_limit_cooldown OR
            _account_use_counter < drop_account_limit;
    END IF;

END;
$$;