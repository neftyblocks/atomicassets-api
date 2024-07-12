import * as express from 'express';

import { HTTPServer } from '../../../server';
import {
    getOpenAPI3Responses, paginationParameters,
} from '../../../docs';
import {getLaunchDetail, getLaunchDetailByCode, getLaunches, getLaunchesCount} from '../handlers/launches';
import {LaunchesNamespace} from '../index';

export function launchesEndpoints(core: LaunchesNamespace, server: HTTPServer, router: express.Router): any {
    const { caching, returnAsJSON } = server.web;
    router.all('/v1/launches', caching(), returnAsJSON(getLaunches, core));
    router.all('/v1/launches/_count', caching(), returnAsJSON(getLaunchesCount, core));
    router.all('/v1/launches/:launch_id', caching(), returnAsJSON(getLaunchDetail, core));
    router.all('/v1/launches/:token_contract/:token_code', caching(), returnAsJSON(getLaunchDetailByCode, core));

    return {
        tag: {
            name: 'launchbagz',
            description: 'Launches'
        },
        paths: {
            '/v1/launches': {
                get: {
                    tags: ['launchbagz'],
                    summary: 'Get token launches',
                    description:
                        'Get launches for a token',
                    parameters: [
                        {
                            name: 'token_contract',
                            in: 'query',
                            description: 'Token contract',
                            required: false,
                            schema: {
                                type: 'string',
                            }
                        },
                        {
                            name: 'token_code',
                            in: 'query',
                            description: 'Token code',
                            required: false,
                            schema: {
                                type: 'string',
                            }
                        },
                        {
                            name: 'authorized_account',
                            in: 'query',
                            description: 'Authorized account',
                            required: false,
                            schema: {
                                type: 'string',
                            }
                        },
                        {
                            name: 'is_hidden',
                            in: 'query',
                            description: 'Is hidden',
                            required: false,
                            schema: {
                                type: 'boolean',
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
                                enum: ['token_contract', 'token_code', 'created_at_time', 'updated_at_time'],
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
                        items: {'$ref': '#/components/schemas/LaunchMinimal'}
                    })
                }
            },
            '/v1/launches/{launch_id}': {
                get: {
                    tags: ['launchbagz'],
                    summary: 'Get a specific launch by id',
                    parameters: [
                        {
                            in: 'path',
                            name: 'launch_id',
                            description: 'Launch Id',
                            required: true,
                            schema: {type: 'integer'}
                        },
                    ],
                    responses: getOpenAPI3Responses([200, 416, 500], {'$ref': '#/components/schemas/LaunchDetails'})
                }
            },
            '/v1/launches/{token_contract}/{token_code}': {
                get: {
                    tags: ['launchbagz'],
                    summary: 'Get a specific launch by token contract and token code',
                    parameters: [
                        {
                            in: 'path',
                            name: 'token_contract',
                            description: 'Token contract',
                            required: true,
                            schema: {type: 'string'}
                        },
                        {
                            in: 'path',
                            name: 'token_code',
                            description: 'Token code',
                            required: true,
                            schema: {type: 'string'}
                        },
                    ],
                    responses: getOpenAPI3Responses([200, 416, 500], {'$ref': '#/components/schemas/LaunchDetails'})
                }
            },
        }
    };
}
