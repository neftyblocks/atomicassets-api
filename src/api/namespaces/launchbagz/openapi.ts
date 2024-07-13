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
    },
    TokenFarm: {
        type: 'object',
        properties: {
            contract: {type: 'string'},
            farm_name: {type: 'string'},
            creator: {type: 'string'},
            original_creator: {type: 'string'},
            staking_token: {
                type: 'object',
                properties: {
                    token_contract: {type: 'string'},
                    token_symbol: {type: 'string'},
                    token_precision: {
                        type: 'integer',
                        format: 'int32'
                    }
                }
            },
            total_staked: {
                'type': 'string'
            },
            vesting_time: {
                'type': 'string'
            },
            rewards: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'integer',
                            format: 'int32'
                        },
                        period_start: {
                            type: 'integer',
                            format: 'int64'
                        },
                        period_finish: {
                            type: 'integer',
                            format: 'int64'
                        },
                        reward_rate: {
                            type: 'integer',
                            format: 'int64'
                        },
                        reward_duration: {
                            type: 'integer',
                            format: 'int32'
                        },
                        reward_per_token_stored: {
                            type: 'integer',
                            format: 'int64'
                        },
                        token: {
                            type: 'object',
                            properties: {
                                token_contract: {type: 'string'},
                                token_symbol: {type: 'string'},
                                token_precision: {
                                    'type': 'integer',
                                    'format': 'int32'
                                }
                            }
                        },
                        reward_pool: {
                            type: 'integer',
                            format: 'int64'
                        },
                        total_rewards_paid_out: {
                            type: 'integer',
                            format: 'int64'
                        }
                    }
                }
            },
            staker_balance: {
                type: 'integer',
                format: 'int64'
            },
            updated_at_block: {type: 'string'},
            updated_at_time: {type: 'string'},
            created_at_block: {type: 'string'},
            created_at_time: {type: 'string'}
        },
    },
    FarmStaker: {
        type: 'object',
        properties: {
            contract: {type: 'string'},
            farm_name: {type: 'string'},
            owner: {type: 'string'},
            balance: {
                type: 'object',
                properties: {
                    token_contract: {type: 'string'},
                    token_symbol: {type: 'string'},
                    token_precision: {
                        'type': 'integer',
                        'format': 'int32'
                    },
                    amount: {
                        type: 'integer',
                        format: 'int64'
                    }
                }
            },
            share: {
                type: 'integer',
                format: 'int32'
            },
            vesting_end_time: {type: 'string'},
            updated_at_block: {type: 'string'},
            updated_at_time: {type: 'string'},
        },
    },
    VestingDetails: {
        contract: {type: 'string'},
        vesting_id: {type: 'string'},
        recipient: {type: 'string'},
        owner: {type: 'string'},
        token_contract: {type: 'string'},
        token_code: {type: 'string'},
        token_precision: {type: 'integer', format: 'int32'},
        start_time: {type: 'string'},
        last_claim_time: {type: 'string'},
        total_claimed: {type: 'string'},
        immediate_unlock: {type: 'string'},
        total_allocation: {type: 'string'},
        period_length: {type: 'string'},
        total_periods: {type: 'string'},
        description: {type: 'string'},
        is_active: {type: 'boolean'},
        updated_at_block: {type: 'string'},
        updated_at_time: {type: 'string'},
        created_at_block: {type: 'string'},
        created_at_time: {type: 'string'}
    }
};
