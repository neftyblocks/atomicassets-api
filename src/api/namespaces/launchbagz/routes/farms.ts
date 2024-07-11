import * as express from 'express';

import { HTTPServer } from '../../../server';
import {
    getOpenAPI3Responses, paginationParameters,
} from '../../../docs';
import {LaunchesNamespace} from '../index';
import {
    getFarmDetail,
    getFarms,
    getFarmsCount,
    getFarmStakers,
    getFarmStakersCount,
    getStakers,
    getStakersCount
} from '../handlers/farms';

export function farmsEndpoints(core: LaunchesNamespace, server: HTTPServer, router: express.Router): any {
    const { caching, returnAsJSON } = server.web;
    router.all('/v1/farms', caching(), returnAsJSON(getFarms, core));
    router.all('/v1/farms/_count', caching(), returnAsJSON(getFarmsCount, core));
    router.all('/v1/farms/:farm_name', caching(), returnAsJSON(getFarmDetail, core));
    router.all('/v1/farms/:farm_name/stakers', caching(), returnAsJSON(getFarmStakers, core));
    router.all('/v1/farms/:farm_name/stakers/_count', caching(), returnAsJSON(getFarmStakersCount, core));
    router.all('/v1/stakers/_count', caching(), returnAsJSON(getStakersCount, core));
    router.all('/v1/stakers', caching(), returnAsJSON(getStakers, core));

    return {
        tag: {
            name: 'launchbagz',
            description: 'Launches'
        },
        paths: {
            '/v1/farms': {
                get: {
                    tags: ['launchbagz'],
                    summary: 'Get token farms',
                    description:
                        'Get farms that reward tokens when staking a token',
                    parameters: [
                        {
                            name: 'staked_token',
                            in: 'query',
                            description: 'Staked token in the format [symbol_code]@[contract]',
                            required: false,
                            schema: {
                                type: 'string',
                            }
                        },
                        {
                            name: 'reward_token',
                            in: 'query',
                            description: 'Token contract in the format [symbol_code]@[contract]',
                            required: false,
                            schema: {
                                type: 'string',
                            }
                        },
                        {
                            name: 'creator',
                            in: 'query',
                            description: 'Farm creator',
                            required: false,
                            schema: {
                                type: 'string',
                            }
                        },
                        {
                            name: 'original_creator',
                            in: 'query',
                            description: 'Original Farm creator (Different when the creator is a partner)',
                            required: false,
                            schema: {
                                type: 'string',
                            }
                        },
                        ...paginationParameters,
                        {
                            name: 'sort',
                            in: 'query',
                            description: 'Column to sort',
                            required: false,
                            schema: {
                                type: 'string',
                                enum: ['created_at_time', 'updated_at_time'],
                                default: 'created_at_time'
                            }
                        },
                        {
                            name: 'order',
                            in: 'query',
                            description: 'Order direction',
                            required: false,
                            schema: {
                                type: 'string',
                                enum: ['asc', 'desc'],
                                default: 'desc'
                            }
                        }
                    ],
                    responses: getOpenAPI3Responses([200, 500], {
                        type: 'array',
                        items: {'$ref': '#/components/schemas/TokenFarm'}
                    })
                }
            },
            '/v1/farms/{farm_name}': {
                get: {
                    tags: ['launchbagz'],
                    summary: 'Get a specific farm by name',
                    parameters: [
                        {
                            in: 'path',
                            name: 'farm_name',
                            description: 'Farm name',
                            required: true,
                            schema: {type: 'string'}
                        },
                    ],
                    responses: getOpenAPI3Responses([200, 416, 500], {'$ref': '#/components/schemas/TokenFarm'})
                }
            },
            '/v1/farms/{farm_name}/stakers': {
                get: {
                    tags: ['launchbagz'],
                    summary: 'Get the stakers in a farm',
                    parameters: [
                        {
                            in: 'path',
                            name: 'farm_name',
                            description: 'Farm name',
                            required: true,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'owner',
                            in: 'query',
                            description: 'Staker address',
                            required: false,
                            schema: {
                                type: 'string',
                            }
                        },
                        ...paginationParameters,
                        {
                            name: 'sort',
                            in: 'query',
                            description: 'Column to sort',
                            required: false,
                            schema: {
                                type: 'string',
                                enum: ['owner', 'updated_at_time', 'share'],
                                default: 'owner'
                            }
                        },
                        {
                            name: 'order',
                            in: 'query',
                            description: 'Order direction',
                            required: false,
                            schema: {
                                type: 'string',
                                enum: ['asc', 'desc'],
                                default: 'desc'
                            }
                        }
                    ],
                    responses: getOpenAPI3Responses([200, 416, 500], {'$ref': '#/components/schemas/FarmStaker'})
                }
            },
            '/v1/stakers': {
                get: {
                    tags: ['launchbagz'],
                    summary: 'Get token farms stakers',
                    description:
                        'Get the users that staked tokens in farms',
                    parameters: [
                        {
                            name: 'farm_name',
                            in: 'query',
                            description: 'Token farm name',
                            required: false,
                            schema: {
                                type: 'string',
                            }
                        },
                        {
                            name: 'owner',
                            in: 'query',
                            description: 'Staker address',
                            required: false,
                            schema: {
                                type: 'string',
                            }
                        },
                        ...paginationParameters,
                        {
                            name: 'sort',
                            in: 'query',
                            description: 'Column to sort',
                            required: false,
                            schema: {
                                type: 'string',
                                enum: ['owner', 'updated_at_time', 'share'],
                                default: 'owner'
                            }
                        },
                        {
                            name: 'order',
                            in: 'query',
                            description: 'Order direction',
                            required: false,
                            schema: {
                                type: 'string',
                                enum: ['asc', 'desc'],
                                default: 'desc'
                            }
                        }
                    ],
                    responses: getOpenAPI3Responses([200, 500], {
                        type: 'array',
                        items: {'$ref': '#/components/schemas/FarmStaker'}
                    })
                }
            },
        }
    };
}
