export type SuperBlendTableRow = {
    blend_id: number,
    collection_name: string,
    start_time: number,
    end_time: number,
    ingredients: any[],
    rolls: any[],
    max: number,
    use_count: number,
    display_data: string,
    security_id?: number,
    is_hidden?: boolean,
    category?: string,
    upgrade_specs?: any[]
};

export type SuperBlendLimitRow = {
    blend_id: number,
    account_limit: number,
    account_limit_cooldown: number,
};

export type ValueOutcome = {
    // variant: RESULT_VALUE
    result: any[],
    odds: number
}

export type SuperBlendValuerollsTableRow = {
    id: string,
    value_outcomes: ValueOutcome[],
    total_odds: number
}

export type Result = {
    result_index: number,
    type: string,
    payload: any,
};

export type Outcome = {
    odds: number,
    outcome_index: number,
    results: any[],
};

export type Roll = {
    outcomes: Outcome[],
    roll_index: number,
    total_odds: number,
};

export type BlendTableRow = {
    owner: string,
    collection: string,
    target: number,
    mixture: number[],
};

export type ConfigTableRow = {
    supported_tokens: Array<{
        contract: string,
        sym: string
    }>,
    fee: number,
    fee_recipient: string,
};
