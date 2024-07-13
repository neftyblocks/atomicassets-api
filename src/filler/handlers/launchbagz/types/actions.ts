export type LogNewLaunchAction = {
    launch_id: number,
    amount?: {
        quantity: string;
        contract: string;
    },
    token: {
        sym: string;
        contract: string;
    },
    is_hidden: boolean;
    display_data: string;
    issuer: string;
};

export type CreatePartnerFarmAction = {
    creator: string;
    farm_name: string;
    staking_token: {
        contract: string;
        sym: string;
    };
    vesting_time: number;
};

export type LogNewVestingAction = {
    vesting_id: string,
    recipient: string,
    owner: string,
    token: {
        sym: string,
        contract: string,
    }
    start_time: number,
    immediate_unlock: string,
    total_allocation: string,
    period_length: number,
    total_periods: number,
    description: string,
};

export type LogClaimAction = {
    vesting_id: string,
    claimed_amount: string,
    new_total_claimed: string,
    total_allocation: string,
};
