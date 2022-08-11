DROP FUNCTION IF EXISTS neftydrops_is_account_in_whitelist(account_name character varying(13), drop_id bigint, drop_account_limit bigint, drop_account_limit_cooldown bigint);
CREATE FUNCTION neftydrops_is_account_in_whitelist(
  IN _account_name character varying(13),
  IN _drop_id bigint
)
    RETURNS bool
    LANGUAGE plpgsql
as
$$
declare
    _use_counter BIGINT := null;
    _last_claim_time BIGINT := null;
BEGIN
    -- @TODO
END;
$$;
