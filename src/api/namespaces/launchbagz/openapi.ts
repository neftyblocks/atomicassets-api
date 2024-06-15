
export const launchBagzComponents = {
    LaunchMinimal: {
        type: 'object',
        properties: {
            launch_id: {type: 'string'},
            title: {type: 'string'},
            hide: {type: 'boolean'},
            token_contract: {type: 'string'},
            token_code: {type: 'string'},
            token_precision: {type: 'string'},
            launch_date: {type: 'string'},
            image: {type: 'string'},
            authorized_accounts: {type: 'array', items: {type: 'string'}},
            token_image: {type: 'string'},
        },
    },
    LaunchDetails: {
        type: 'object',
        properties: {
            launch_id: {type: 'string'},
            title: {type: 'string'},
            hide: {type: 'boolean'},
            token_contract: {type: 'string'},
            token_code: {type: 'string'},
            token_precision: {type: 'string'},
            launch_date: {type: 'string'},
            image: {type: 'string'},
            token_image: {type: 'string'},
            authorized_accounts: {type: 'string[]'},
            blend: {$ref: '#/components/schemas/BlendDetails'},
        },
    },
    TokenDetails: {
        type: 'object',
        properties: {
            contract: {type: 'string'},
            token_contract: {type: 'string'},
            token_code: {type: 'string'},
            image: {type: 'string'},
            tx_fee: {type: 'number'},
            created_at_time: {type: 'string'},
            created_at_block: {type: 'string'},
            updated_at_time: {type: 'string'},
            updated_at_block: {type: 'string'},
        },
    }
};
