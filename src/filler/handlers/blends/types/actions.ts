export type SetBlendRollsActionData = {
    blend_id: number,
    rolls: any[],
};

export type SetBlendMixActionData = {
    blend_id: number,
    ingredients: any[],
};

export type LogClaimActionData = {
    claim_id: number,
    blend_id: number,
    transferred_assets: Array<number>,
    own_assets: Array<number>,
    claimer: string,
};

export type LogResultActionData = {
    claim_id: number,
    blend_id: number,
    results: Record<string, any>,
    claimer: string,
};
