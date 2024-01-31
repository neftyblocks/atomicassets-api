
export const neftyUpgradesComponents = {
    UpgradeDetails: {
        type: 'object',
        properties: {
            upgrade_id: {type: 'string'},
            contract: {type: 'string'},
            collection_name: {type: 'string'},
            start_time: {type: 'string'},
            end_time: {type: 'string'},
            max: {type: 'string'},
            use_count: {type: 'string'},
            display_data: {type: 'string'},
            created_at_time: {type: 'string'},
            ingredients_count: {type: 'string'},
            security_id: {type: 'string'},
            is_hidden: {type: 'boolean', default: false},
            category: {type: 'string'},
            ingredients: {
                type: 'array',
                items: {
                    type: 'object'
                }
            },
            upgrade_specs: {
                type: 'array',
                items: {
                    type: 'object'
                }
            }
        },
    },
    UpgradeClaim: {
        type: 'object',
        properties: {
            claim_id: {type: 'string'},
            contract: {type: 'string'},
            claimer: {type: 'string'},
            upgrade_id: {type: 'string'},
            created_at_time: {type: 'string'},
            created_at_block: {type: 'string'},
            updated_at_time: {type: 'string'},
            updated_at_block: {type: 'string'},
            results: {
                type: 'array',
                items: {type: 'object'}
            },
            transferred_assets: {
                type: 'array',
                items: {type: 'object'}
            },
            own_assets: {
                type: 'array',
                items: {type: 'object'}
            }
        },
    }
};
