export type SetUpgradeMixActionData = {
    upgrade_id: number,
    ingredients: any[],
};

export type LogClaimActionData = {
    claim_id: number,
    upgrade_id: number,
    transferred_assets: number[],
    own_assets: number[],
    mutations: Mutation[],
    claimer: string,
};

export type Mutation = {
    asset_id: number,
    new_mutable_data: {
        [key: string]: [string, any],
    },
}
