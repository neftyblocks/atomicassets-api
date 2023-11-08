import * as express from 'express';

import { NeftyPacksNamespace } from '../index';
import { HTTPServer } from '../../../server';
import {
    getOpenAPI3Responses,
    paginationParameters,
} from '../../../docs';
import {
    greylistFilterParameters,
} from '../../atomicassets/openapi';
import {getPackAction, getPacksAction, getPacksCountAction} from '../handlers/packs';

export function packsEndpoints(core: NeftyPacksNamespace, server: HTTPServer, router: express.Router): any {
    const {caching, returnAsJSON} = server.web;
    router.all('/v1/packs', caching(), returnAsJSON(getPacksAction, core));
    router.all('/v1/packs/_count', caching(), returnAsJSON(getPacksCountAction, core));
    router.all('/v1/packs/:contract/:pack_id', caching(), returnAsJSON(getPackAction, core));

    return {
        tag: {
            name: 'packs',
            description: 'Packs'
        },
        paths: {
            '/v1/packs': {
                get: {
                    tags: ['packs'],
                    summary: 'Fetch packs.',
                    description: 'Fetch packs in the nefty and atomic contracts.',
                    parameters: [
                        {
                            name: 'collection_name',
                            in: 'query',
                            description: 'Filter by collection name',
                            required: false,
                            schema: {type: 'string' }
                        },
                        {
                            name: 'contract',
                            in: 'query',
                            description: 'Filter by pack contract',
                            required: false,
                            schema: {type: 'string' }
                        },
                        {
                            name: 'hide_description',
                            in: 'query',
                            description: 'Removed the drop description from the response',
                            required: false,
                            schema: {type: 'boolean', default: false}
                        },
                        {
                            name: 'display_pending',
                            in: 'query',
                            description: 'Display pending packs',
                            required: false,
                            schema: {type: 'boolean', default: false}
                        },
                        {
                            name: 'render_markdown',
                            in: 'query',
                            description: 'Renders the markdown in the description as HTML',
                            required: false,
                            schema: {type: 'boolean', default: false}
                        },
                        ...greylistFilterParameters,
                        ...paginationParameters,
                        {
                            name: 'sort',
                            in: 'query',
                            description: 'Column to sort',
                            required: false,
                            schema: {
                                type: 'string',
                                enum: [
                                    'pack_id',
                                ],
                                default: 'pack_id'
                            }
                        }
                    ],
                    responses: getOpenAPI3Responses([200, 500], {type: 'array', items: {'$ref': '#/components/schemas/NeftyPack'}})
                }
            },
            '/v1/packs/{contract}/{pack_id}': {
                get: {
                    tags: ['packs'],
                    summary: 'Fetch pack.',
                    description: 'Fetch pack in the nefty and atomic contracts.',
                    parameters: [
                        {
                            name: 'contract',
                            in: 'path',
                            description: 'Pack contract',
                            required: true,
                            schema: {type: 'string' }
                        },
                        {
                            name: 'pack_id',
                            in: 'path',
                            description: 'Pack id',
                            required: true,
                            schema: {type: 'string' }
                        },
                        {
                            name: 'hide_description',
                            in: 'query',
                            description: 'Removed the drop description from the response',
                            required: false,
                            schema: {type: 'boolean', default: false}
                        },
                        {
                            name: 'render_markdown',
                            in: 'query',
                            description: 'Renders the markdown in the description as HTML',
                            required: false,
                            schema: {type: 'boolean', default: false}
                        },
                    ],
                    responses: getOpenAPI3Responses([200, 500], {type: 'object', items: {'$ref': '#/components/schemas/NeftyPack'}})
                }
            }
        }
    };
}
