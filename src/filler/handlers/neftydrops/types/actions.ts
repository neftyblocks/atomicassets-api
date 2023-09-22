export type LogCreateDropActionData = {
    drop_id: number,
    collection_name: string,
    assets_to_mint: Array<{
        template_id: number,
        tokens_to_back: string[],
        use_pool: boolean,
    }>,
    result?: Array<any>,
    listing_price: string,
    settlement_symbol: string,
    price_recipient: string,
    fee_rate: number,
    auth_required: boolean,
    max_claimable: number,
    account_limit: number,
    account_limit_cooldown: number,
    start_time: number,
    end_time: number,
    display_data: string,
    is_hidden?: boolean
    allow_credit_card_payments?: boolean
    referral_fee?: number
    referral_whitelist_id?: number
};

export type SetDropAuthActionData = {
    authorized_account: string,
    drop_id: number,
    auth_required: boolean
};

export type SetDropDataActionData = {
    authorized_account: string,
    drop_id: number,
    display_data: string
};

export type SetDropLimitActionData = {
    authorized_account: string,
    drop_id: number,
    account_limit: number,
    account_limit_cooldown: number
};

export type SetDropMaxActionData = {
    authorized_account: string,
    drop_id: number,
    new_max_claimable: number
};

export type SetDropHiddenActionData = {
    authorized_account: string,
    drop_id: number,
    is_hidden: boolean
};

export type SetDropPaymentActionData = {
    authorized_account: string,
    drop_id: number,
    allow_credit_card_payments: boolean
};

export type SetDropReferralFeeActionData = {
    authorized_account: string,
    drop_id: number,
    referral_fee: number
    referral_whitelist_id?: number
};

export type SetDropPriceActionData = {
    authorized_account: string,
    drop_id: number,
    listing_price: string,
    settlement_symbol: string
};

export type SetDropTimesActionData = {
    authorized_account: string,
    drop_id: number,
    start_time: number,
    end_time: number
};

export type EraseDropActionData = {
    authorized_account: string,
    drop_id: number
};

export type ClaimDropActionData = {
    claimer: string;
    drop_id: number,
    amount: string,
    intended_delphi_median?: string,
    referrer: string,
    country: string
    receipt_id?: string,
    referrer_account?: string,
};

export type LogClaimActionData = {
    drop_id: number,
    claimer: string,
    quantity: number,
    amount_paid: string,
    core_symbol_amount: string,
    intended_delphi_median?: string,
};
