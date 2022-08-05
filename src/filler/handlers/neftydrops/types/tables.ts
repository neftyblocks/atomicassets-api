export type DropsTableRow = {
    drop_id: string,
    collection_name: string,
    assets_to_mint: Array<{
        template_id: number,
        tokens_to_back: string[],
        use_pool: boolean,
    }>,
    listing_price: string,
    settlement_symbol: string,
    price_recipient: string,
    fee_rate: number,
    auth_required: boolean,
    account_limit: number,
    account_limit_cooldown: number,
    max_claimable: number,
    current_claimed: number,
    start_time: number,
    end_time: number,
    display_data: string,
    ram_payer: string,
};

export type ConfigTableRow = {
    version: string,
    supported_tokens: Array<{
        token_contract: string,
        token_symbol: string
    }>,
    supported_symbol_pairs: Array<{
        listing_symbol: string,
        settlement_symbol: string,
        delphi_pair_name: string,
        invert_delphi_pair: boolean
    }>,
    drop_fee: number,
    drop_fee_recipient: string,
    atomicassets_account: string,
    delphioracle_account: string
};

export type BalancesTableRow = {
    owner: string,
    quantities: string[]
};

export type AccountStats = {
    drop_id: string,
    counter: number,
    last_claim_time: string,
    used_nonces: string[],
}
export type AccountStatsRow = {
    claimer: string,
    drop_id: string,
    use_counter: number,
    last_claim_time: string,
    used_nonces: string[],
}
export type AccountsWhitelist = {
    account: string,
    account_limit: number,
}
export type AccountsWhitelistRow = {
    drop_id: string,
    account: string,
    account_limit: number,
}
export type AuthKeys = {
    key: string,
    key_limit: number,
    key_limit_cooldown: number,
    counter: number,
    last_claim_time: number,
}
export type AuthKeysRow = {
    drop_id: string,
    public_key: string,
    key_limit: number,
    key_limit_cooldown: number,
    use_counter: number,
    last_claim_time: number,
}