export type LogBackAssetActionData = {
    asset_owner: string,
    asset_id: string,
    backer: string,
    collection_name: string,
    schema_name: string,
    template_id: number,
    tokens_to_back: {
        quantity: string,
        token_contract: string,
    }[]
};
