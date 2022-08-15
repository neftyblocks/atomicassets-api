export type ProofOfOwnership = {
    drop_id: string,
    group: {
        logical_operator: number,
        filters: Array<Array<any>>,
    },
}
export type ProofOfOwnershipRow = {
    drop_id: string,
    logical_operator: number,
    filters: string,
    // filters: Array<
    //     CollectionFilter|TemplateFilter|SchemaFilter|TokenFilter
    // >,
}
export type CollectionFilter = {
    filter_kind: string,
    collection_name: string,
    comparison_operator: number,
    amount: number,
}
export type TemplateFilter = {
    filter_kind: string,
    collection_name: string,
    template_id: string,
    comparison_operator: number,
    amount: number,
}
export type SchemaFilter = {
    filter_kind: string,
    collection_name: string,
    schema_name: string,
    comparison_operator: number,
    amount: number,
}
export type TokenFilter = {
    filter_kind: string,
    token_contract: string,
    token_symbol: string,
    comparison_operator: number,
    amount: {
        quantity: number,
        symbol: string,
    },
}