-- checks if account is in whitelist and if it has whitelist uses remaining
DROP FUNCTION IF EXISTS neftydrops_is_account_in_whitelist(
    _account_name character varying(13),
    _account_use_counter bigint,
    _drop_id bigint
);

CREATE FUNCTION neftydrops_is_account_in_whitelist(
  IN _account_name character varying(13),
  IN _account_use_counter bigint,
  IN _drop_id bigint
)
    RETURNS bool
    LANGUAGE plpgsql
as
$$
declare
    _whitelist_account_limit BIGINT := null;
BEGIN
    SELECT INTO _whitelist_account_limit 
        account_limit
    FROM neftydrops_accounts_whitelist
    WHERE
        account = _account_name AND
        drop_id = _drop_id;


    -- it means account is not in whitelist
    IF (_whitelist_account_limit is null) THEN
        return false;
    END IF;

    -- it means this whiteslist doesn't have account limits
    IF (_whitelist_account_limit = 0) THEN
        return true;
    END IF;

    return _whitelist_account_limit > _account_use_count;
END;
$$;