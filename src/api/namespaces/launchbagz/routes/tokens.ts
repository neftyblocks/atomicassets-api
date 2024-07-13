import * as express from 'express';

import { HTTPServer } from '../../../server';
import {
    getOpenAPI3Responses,
    paginationParameters,
} from '../../../docs';
import {getToken, getTokensAction} from '../handlers/tokens';
import {LaunchesNamespace} from '../index';
import {getTokenSplits} from '../handlers/vestings';

export function tokensEndpoints(core: LaunchesNamespace, server: HTTPServer, router: express.Router): any {
    const { caching, returnAsJSON } = server.web;
    router.all(
        '/v1/tokens',
        caching(),
        returnAsJSON(getTokensAction, core)
    );
    router.all(
        '/v1/tokens/:token_contract/:token_code',
        caching(),
        returnAsJSON(getToken, core)
    );
    router.all(
        '/v1/tokens/:token_contract/:token_code/splits',
        caching(),
        returnAsJSON(getTokenSplits, core)
    );

    return {
        tag: {
            name: 'launchbagz',
            description: 'LaunchBagz'
        },
        paths: {
            '/v1/tokens': {
                get: {
                    tags: ['launchbagz'],
                    summary: 'Get all the tokens that match the given filters',
                    description:
                        'Get all the tokens that match the given filters',
                    parameters: [
                        {
                            name: 'token_contract',
                            in: 'query',
                            description: 'Contract of the token. Comma separated list.',
                            required: false,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'has_fees',
                            in: 'query',
                            description: 'Filter by whether the token has fees',
                            required: false,
                            schema: {type: 'boolean'}
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
                                default: 'token_code'
                            }
                        },
                    ],
                    responses: getOpenAPI3Responses([200, 500], {
                        type: 'array',
                        items: {'$ref': '#/components/schemas/TokenDetails'}
                    })
                }
            },
            '/v1/tokens/{token_contract}/{token_code}': {
                get: {
                    tags: ['launchbagz'],
                    summary: 'Get a specific launch by id',
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
                    responses: getOpenAPI3Responses([200, 416, 500], {'$ref': '#/components/schemas/TokenDetails'})
                }
            },
            '/v1/tokens/{token_contract}/{token_code}/splits': {
                get: {
                    tags: ['launchbagz'],
                    summary: 'Get the split vestings for a specific token',
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
                    responses: getOpenAPI3Responses([200, 416, 500], {'$ref': '#/components/schemas/VestingDetails'})
                }
            },
        }
    };
}
