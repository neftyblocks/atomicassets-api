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
