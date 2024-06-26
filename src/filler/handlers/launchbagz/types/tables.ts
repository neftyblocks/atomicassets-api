export type LaunchTableRow = {
    launch_id: number,
    blend_contract: string,
    blend_id: number,
    contract: string,
    code: string,
    launch_date: number;
    is_hidden: boolean;
    display_data: string;
};

export type ImageTableRow = {
    code: string,
    img: string;
};

export type TokenConfigTableRow = {
    code: string,
    tx_fees: {
        recipient: string,
        bps: number
    }[],
};

export type ChadConfigTableRow = {
    sym: string,
    fee_receivers: {
        receiver: string,
        fee: number
    }[],
};

export type KeksConfigTableRow = {
    transaction_fee_percent: number,
    dev_fee_percent: number,
    is_active: boolean
};

export type VestingTableRow = {
    vesting_id: string,
    recipient: string,
    owner: string,
    token: {
        sym: string,
        contract: string,
    }
    start_time: number,
    last_claim_time: number,
    total_claimed: string,
    immediate_unlock: string,
    total_allocation: string,
    period_length: number,
    total_periods: number,
    description: string,
};
