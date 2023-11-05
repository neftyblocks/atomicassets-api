export type PacksTableRow = {
    pack_id: number,
    collection_name: string,
    unlock_time: number,
    pack_template_id: number,
    use_count: number,
    recipe_id?: number,
    display_data: string,
};
