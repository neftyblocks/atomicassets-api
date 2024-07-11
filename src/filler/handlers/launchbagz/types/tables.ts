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

export type TokenFarmTableRow = {
    farm_name: string;
    creator: string;
    time_created: number;
    staking_token: {
        sym: string,
        contract: string
    };
    incentive_count: number;
    total_staked: string;
    vesting_time: number;
    last_update_time: number;
};

export type TokenFarmRewardTableRow = {

    id: string;
    period_start: number;
    period_finish: number;
    reward_rate: string;
    rewards_duration: number;
    reward_per_token_stored: string;
    reward_pool: {
        quantity: string,
        contract: string
    };
    total_rewards_paid_out: string;
};

export type TokenFarmPartner = {
    wallet: string,
    discount_1e6: number,
};

export type TokenFarmPartnerFarm = {
    farm_name: string,
    creator: string,
};

export type TokenFarmStaker = {
    farm_name: string,
    balance: string,
    last_update: number,
    vesting_end_time: number,
};
