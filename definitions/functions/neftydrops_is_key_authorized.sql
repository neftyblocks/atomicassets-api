DROP FUNCTION IF EXISTS neftydrops_is_key_authorized(
  _public_keys character varying(53)[],
  _drop_id bigint
);

CREATE FUNCTION neftydrops_is_key_authorized(
  IN _public_keys character varying(53)[],
  IN _drop_id bigint
)
    RETURNS bool
    LANGUAGE plpgsql
as
$$
BEGIN
    return EXISTS(
        select 
            -- public_key,
            drop_id
            -- key_limit,
            -- key_limit_cooldown,
            -- use_counter,
            -- last_claim_time
        from neftydrops_authkeys authkey
        where 
            EXISTS (SELECT FROM UNNEST(_public_keys) u(c) WHERE u.c = authkey.public_key)
            AND authkey.drop_id = _drop_id
            AND (
                -- if there is no key limit it means that authkey.public_key 
                -- always has auth on that authkey.drop_id
                key_limit=0 
                OR (
                    -- regardless of if there is or there isn't cooldown if 
                    -- use_counter<key_limit they public_key has auth on that drop_id
                    use_counter < key_limit
                    OR (
                        -- the only remaining way this public_key can have auth 
                        -- is if there is a cooldown_time and it has already expired
                        key_limit_cooldown != 0 AND
                        ((cast(extract(epoch from now()) as bigint) * 1000) - last_claim_time) > key_limit_cooldown
                    )
                )
            )
    );
END;
$$;