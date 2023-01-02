export type BlendTableRow = {
    blend_id: number,
    collection_name: string,
    start_time: number,
    end_time: number,
    accessory_specs: AccessorySpec[],
    base_spec: any,
    lock_spec: any,
    lock_count: number,
    max: number,
    use_count: number,
    display_data: string,
};

export type AccessorySpec = {
    layer_name: string,
    z_index: number,
    default_accessory: [string, any],
    accessory_matches: AccessoryMatch[],
};

export type AccessoryMatch = {
    template_id: number,
    result_value: string,
    result_image: string,
};

export type PreferencesTableRow = {
    key: string,
    value: string,
};
