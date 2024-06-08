import * as express from 'express';

import { HTTPServer } from '../../../server';
import {
    getOpenAPI3Responses,
    paginationParameters,
} from '../../../docs';
import {getTokensAction} from '../handlers/tokens';
import {LaunchesNamespace} from '../index';

export function tokensEndpoints(core: LaunchesNamespace, server: HTTPServer, router: express.Router): any {
    const { caching, returnAsJSON } = server.web;
    router.all(
        '/v1/tokens',
        caching(),
        returnAsJSON(getTokensAction, core)
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
        }
    };
}
