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
