import * as express from 'express';

import { HTTPServer } from '../../../server';
import {
    getOpenAPI3Responses,
    paginationParameters,
} from '../../../docs';
import {LaunchesNamespace} from '../index';
import {getVestings, getVestingsCount} from '../handlers/vestings';

export function vestingsEndpoints(core: LaunchesNamespace, server: HTTPServer, router: express.Router): any {
    const { caching, returnAsJSON } = server.web;
    router.all(
        '/v1/vestings',
        caching(),
        returnAsJSON(getVestings, core)
    );
    router.all(
        '/v1/vestings/_count',
        caching(),
        returnAsJSON(getVestingsCount, core)
    );

    return {
        tag: {
            name: 'launchbagz',
            description: 'LaunchBagz'
        },
        paths: {
            '/v1/vestings': {
                get: {
                    tags: ['launchbagz'],
                    summary: 'Get all the tokens vested that match the given filters',
                    description:
                        'Get all the tokens vested that match the given filters',
                    parameters: [
                        {
                            name: 'token',
                            in: 'query',
                            description: 'Vested token in the format [symbol_code]@[contract]. Comma separated list.',
                            required: false,
                            schema: {
                                type: 'string',
                            }
                        },
                        {
                            name: 'owner',
                            in: 'query',
                            description: 'Creator of the vesting.',
                            required: false,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'recipient',
                            in: 'query',
                            description: 'Recipient of the vesting.',
                            required: false,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'is_active',
                            in: 'query',
                            description: 'Return vestings that have not been completely claimed only',
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
                                enum: ['start_time', 'vesting_id', 'created_at_time', 'updated_at_time', 'total_allocation'],
                                default: 'vesting_id'
                            }
                        },
                    ],
                    responses: getOpenAPI3Responses([200, 500], {
                        type: 'array',
                        items: {'$ref': '#/components/schemas/VestingDetails'}
                    })
                }
            },
        }
    };
}
