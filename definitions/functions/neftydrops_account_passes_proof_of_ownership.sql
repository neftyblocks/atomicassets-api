DROP FUNCTION IF EXISTS neftydrops_account_passes_proof_of_ownership(
  _account character varying(13),
  _drop_id bigint
);

CREATE FUNCTION neftydrops_account_passes_proof_of_ownership(
  IN _account character varying(13),
  IN _drop_id bigint
)
    RETURNS bool
    LANGUAGE plpgsql
as
$$
BEGIN
    return exists(
        select
            asset_matches_sub.drop_id,
            asset_matches_sub.logical_operator AS "logical_operator",
            count(1) AS "fulfilled_filters",
            asset_matches_sub.total_filter_count AS "total_filter_count"
        FROM (
            select
                "filter".drop_id,
                "filter".filter_index,
                "filter".logical_operator,
                "filter".total_filter_count,
                "filter".comparison_operator,
                "filter".nft_amount as "required",
                count(distinct asset.asset_id) as "owned"
            from neftydrops_proof_of_ownership_filters "filter"
            join atomicassets_assets asset ON
                asset.owner=_account AND "filter".filter_kind != 'TOKEN_HOLDING' AND
                (
                    ("filter".filter_kind = 'COLLECTION_HOLDINGS' AND asset.collection_name = "filter".collection_holdings->>'collection_name') OR
                    ("filter".filter_kind = 'SCHEMA_HOLDINGS' AND asset.schema_name = "filter".schema_holdings->>'schema_name' AND "filter".filter_kind = 'SCHEMA_HOLDINGS' AND asset.collection_name = "filter".schema_holdings->>'collection_name') OR
                    ("filter".filter_kind = 'TEMPLATE_HOLDINGS' AND asset.template_id = cast("filter".template_holdings->>'template_id' as bigint))
                )
            where "filter".drop_id=_drop_id
            group by 
                "filter".drop_id,
                "filter".filter_index,
                "filter".total_filter_count,
                "filter".nft_amount
            having 
                ("filter".comparison_operator=0 AND count(distinct asset.asset_id) =  "filter".nft_amount) OR
                ("filter".comparison_operator=1 AND count(distinct asset.asset_id) != "filter".nft_amount) OR
                ("filter".comparison_operator=2 AND count(distinct asset.asset_id) >  "filter".nft_amount) OR
                ("filter".comparison_operator=3 AND count(distinct asset.asset_id) >= "filter".nft_amount) OR
                ("filter".comparison_operator=4 AND count(distinct asset.asset_id) <  "filter".nft_amount) OR
                ("filter".comparison_operator=5 AND count(distinct asset.asset_id) <= "filter".nft_amount)
        ) as asset_matches_sub
        GROUP BY
            asset_matches_sub.drop_id,
            asset_matches_sub.logical_operator,
            asset_matches_sub.total_filter_count
        HAVING
            (logical_operator=0 AND count(1) >= total_filter_count) OR
            (logical_operator=1)
    )

END;
$$;