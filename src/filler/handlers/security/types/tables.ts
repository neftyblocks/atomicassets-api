export type ProofOfOwnership = {
    drop_id: string,
    group: {
        logical_operator: number,
        filters: Array<Array<any>>,
    },
}
export type ProofOfOwnershipFiltersRow = {
    drop_id: string,
    filter_index: number,

    total_filter_count: number,
    logical_operator: number,
    filter_kind: string,

    comparison_operator: number,

    nft_amount: number,

    // only one of these properties won't be null
    collection_holdings: string,
    template_holdings: string,
    schema_holdings: string,
    token_holding: string
}
export type CollectionFilter = {
    collection_name: string,
    comparison_operator: number,
    amount: number,
}
export type TemplateFilter = {
    collection_name: string,
    template_id: string,
    comparison_operator: number,
    amount: number,
}
export type SchemaFilter = {
    collection_name: string,
    schema_name: string,
    comparison_operator: number,
    amount: number,
}
export type TokenFilter = {
    token_contract: string,
    token_symbol: string,
    comparison_operator: number,
    amount: {
        quantity: number,
        symbol: string,
    },
}