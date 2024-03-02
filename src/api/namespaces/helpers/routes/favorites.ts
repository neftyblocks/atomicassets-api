import * as express from 'express';

import {HelpersNamespace} from '../index';
import { HTTPServer } from '../../../server';
import {
    getOpenAPI3Responses,
} from '../../../docs';
import {getCollectionFollowers, getCollectionFollowersCount} from '../handlers/favorites';

export function favoritesEndpoints(core: HelpersNamespace, server: HTTPServer, router: express.Router): any {
    const { caching, returnAsJSON } = server.web;
    router.all('/v1/favorites/followers/:collection_name', caching(), returnAsJSON(getCollectionFollowers, core));
    router.all('/v1/favorites/followers/:collection_name/_count', caching(), returnAsJSON(getCollectionFollowersCount, core));

    return {
        tag: {
            name: 'helpers',
            description: 'Helpers'
        },
        paths: {
            '/v1/favorites/followers/{collection_name}': {
                get: {
                    tags: ['helpers'],
                    summary: 'Get favorite users that follow a collection',
                    description:
                        'Get a list of users that follow a collection',
                    parameters: [
                        {
                            name: 'collection_name',
                            in: 'path',
                            description: 'Collection to get users that follow',
                            required: true,
                            schema: {
                                type: 'string',
                            }
                        },
                        {
                            name: 'sort',
                            in: 'query',
                            description: 'Column to sort',
                            required: false,
                            schema: {
                                type: 'string',
                                enum: ['user_name'],
                                default: 'user_name'
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
                        items: {'$ref': '#/components/schemas/User'}
                    })
                }
            },
        }
    };
}
