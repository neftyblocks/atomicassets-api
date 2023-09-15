export const neftyPacksComponents = {
    NeftyPack: {
        type: 'object',
        properties: {
            contract: {type: 'string'},
            assets_contract: {type: 'string'},
            pack_id: {type: 'string'},
            pack_template: {$ref: '#/components/schemas/Template'},
            collection_name: {type: 'string'},
            collection: {$ref: '#/components/schemas/Collection'},
            display_data: {
                type: 'object', properties: {
                    name: {type: 'string'},
                    description: {type: 'string'},
                }
            },
            updated_at_block: {type: 'string'},
            updated_at_time: {type: 'string'},
            created_at_block: {type: 'string'},
            created_at_time: {type: 'string'},
            unlock_time: {type: 'string'},
        }
    },
};
