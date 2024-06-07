export type LogNewLaunchAction = {
    launch_id: number,
    amount: {
        quantity: string;
        contract: string;
    },
    price: string;
    whitelist_collection_name: string;
    whitelist_template_id: number;
    max_claims: number;
    is_hidden: boolean;
    display_data: string;
    blend_id: number;
};
