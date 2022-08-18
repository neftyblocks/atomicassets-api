DROP TABLE neftydrops_proof_of_ownership_filters;
CREATE TABLE IF NOT EXISTS neftydrops_proof_of_ownership_filters
(
    drop_id                bigint                NOT NULL,
    filter_index           bigint                NOT NULL,

    -- All rows with the same drop_id must have the same logical_operator and 
    -- total_filter_count
    logical_operator       smallint              NOT NULL,
    total_filter_count     bigint                NOT NULL,


    -- Either of four values 'COLLECTION_HOLDINGS', 'TEMPLATE_HOLDINGS',
    -- 'SCHEMA_HOLDINGS', or 'TOKEN_HOLDING'
    filter_kind            character varying(50) NOT NULL,

    -- Equal to the "..._holdings"->'comparison_operator' that is not null
    comparison_operator    smallint              NOT NULL,

    -- NULL if filter_kind == 'TOKEN_HOLDING'.
    -- otherwise it is equal to the "..._holdings"->'amount' that is not null
    nft_amount             bigint,

    -- NULL if filter_kind != 'COLLECTION_HOLDINGS'
    collection_holdings    jsonb,

    -- NULL if filter_kind != 'TEMPLATE_HOLDINGS'
    template_holdings      jsonb,

    -- NULL if filter_kind != 'SCHEMA_HOLDINGS'
    schema_holdings        jsonb, 

    -- NULL if filter_kind != 'TOKEN_HOLDING'
    token_holding          jsonb,

    CONSTRAINT neftydrops_proof_of_ownership_pkey PRIMARY KEY (drop_id, filter_index)
);