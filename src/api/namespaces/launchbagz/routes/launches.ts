import * as express from 'express';

import { HTTPServer } from '../../../server';
import {
    dateBoundaryParameters,
    getOpenAPI3Responses,
} from '../../../docs';
import {getLaunchDetail, getLaunches, getLaunchesCount} from '../handlers/launches';
import {LaunchesNamespace} from '../index';

export function launchesEndpoints(core: LaunchesNamespace, server: HTTPServer, router: express.Router): any {
    const { caching, returnAsJSON } = server.web;
    router.all('/v1/launches', caching(), returnAsJSON(getLaunches, core));
    router.all('/v1/launches/_count', caching(), returnAsJSON(getLaunchesCount, core));
    router.all('/v1/launches/:launch_id', caching(), returnAsJSON(getLaunchDetail, core));

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
                        ...dateBoundaryParameters,
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
        }
    };
}
