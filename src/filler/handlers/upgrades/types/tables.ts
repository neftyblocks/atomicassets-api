export type UpgradeTableRow = {
    upgrade_id: number,
    collection_name: string,
    start_time: number,
    end_time: number,
    ingredients: any[],
    upgrade_specs: any[],
    max: number,
    use_count: number,
    display_data: string,
    security_id: number,
    is_hidden: boolean,
    category: string,
};

export type UpgradeSpec = {
    schema_name: string,
    upgrade_requirements: [string, any][],
    upgrade_results: UpgradeResult[],
}

export type UpgradeResult = {
    attribute_name: string,
    attribute_type: string,
    op: {
        type: number,
    },
    result_value: [string, any],
}

export type ConfigTableRow = {
    supported_tokens: Array<{
        contract: string,
        sym: string
    }>,
    fee: number,
    fee_recipient: string,
};
