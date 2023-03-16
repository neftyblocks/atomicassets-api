import * as express from 'express';

import { NeftyBlendsNamespace} from '../index';
import { HTTPServer } from '../../../server';
import {
    getOpenAPI3Responses,
    paginationParameters,
} from '../../../docs';
import {
    getIngredientOwnershipBlendFilter,
    getBlendDetails,
    getBlendClaimsAction,
    getBlendClaimsCountAction, getBlendIngredientAssets
} from '../handlers/blends';

export function blendsEndpoints(core: NeftyBlendsNamespace, server: HTTPServer, router: express.Router): any {
    const { caching, returnAsJSON } = server.web;
    router.all(
        '/v1/blends',
        caching(),
        returnAsJSON(getIngredientOwnershipBlendFilter, core)
    );
    router.all(
        '/v1/blends/:contract/:blend_id',
        caching(),
        returnAsJSON(getBlendDetails, core)
    );
    router.all(
        '/v1/blends/:contract/:blend_id/claims',
        caching(),
        returnAsJSON(getBlendClaimsAction, core)
    );
    router.all(
        '/v1/blends/:contract/:blend_id/claims/_count',
        caching(),
        returnAsJSON(getBlendClaimsCountAction, core)
    );

    router.all(
        '/v1/blends/:contract/:blend_id/ingredients/:index/assets',
        caching(),
        returnAsJSON(getBlendIngredientAssets, core)
    );

    return {
        tag: {
            name: 'neftyblends',
            description: 'NeftyBlends'
        },
        paths: {
            '/v1/blends': {
                get: {
                    tags: ['neftyblends'],
                    summary: 'Get blends that a given collector has ingredients to',
                    description:
                        'Given a collection and an ingredient_owner, returns all ' +
                        'the blends that both: are in that collection and that the ' +
                        'ingredient_owner owns any or all ingredients to',
                    parameters: [
                        {
                            name: 'contract',
                            in: 'query',
                            description: 'Blend contract of blends (nefty.blend or blenderizerx)',
                            required: false,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'collection_name',
                            in: 'query',
                            description: 'Collection name of blends',
                            required: false,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'ingredient_owner',
                            in: 'query',
                            description: 'User that owns the ingredients that will be tested against each',
                            required: false,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'ingredient_match',
                            in: 'query',
                            description: 'How many ingredients should be matched in each blend (all or any)',
                            required: false,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'available_only',
                            in: 'query',
                            description: 'If true, it filters out all the blends that haven\'t started or have already ended',
                            required: false,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'visibility',
                            in: 'query',
                            description: 'Filter visibility',
                            required: false,
                            schema: {type: 'string', enum: ['visible', 'hidden'], default: ''}
                        },
                        {
                            name: 'category',
                            in: 'query',
                            description: 'Filter by category',
                            required: false,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'render_markdown',
                            in: 'query',
                            description: 'Render the display data as html',
                            required: false,
                            schema: {type: 'boolean', default: false}
                        },
                        ...paginationParameters,
                        {
                            name: 'sort',
                            in: 'query',
                            description: 'Column to sort',
                            required: false,
                            schema: {
                                type: 'string',
                                enum: ['blend_id', 'created_at_time'],
                                default: 'blend_id'
                            }
                        },
                    ],
                    responses: getOpenAPI3Responses([200, 500], {
                        type: 'array',
                        items: {'$ref': '#/components/schemas/BlendDetails'}
                    })
                }
            },
            '/v1/blends/{contract}/{blend_id}': {
                get: {
                    tags: ['neftyblends'],
                    summary: 'Get blend details',
                    description: 'Get details of a single blend',
                    parameters: [
                        {
                            name: 'contract',
                            in: 'path',
                            description: 'Blend contract',
                            required: true,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'blend_id',
                            in: 'path',
                            description: 'Blend id',
                            required: true,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'render_markdown',
                            in: 'query',
                            description: 'Render the display data as html',
                            required: false,
                            schema: {type: 'boolean', default: false}
                        },
                    ],
                    responses: getOpenAPI3Responses([200, 500], { '$ref': '#/components/schemas/BlendDetails' })
                }
            },
            '/v1/blends/{contract}/{blend_id}/claims': {
                get: {
                    tags: ['neftyblends'],
                    summary: 'Get blend claims',
                    description: 'Get claims of a single blend',
                    parameters: [
                        {
                            name: 'contract',
                            in: 'path',
                            description: 'Blend contract',
                            required: true,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'blend_id',
                            in: 'path',
                            description: 'Blend id',
                            required: true,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'tx_id',
                            in: 'query',
                            description: 'Transaction id',
                            required: false,
                            schema: {type: 'string', default: ''}
                        },
                        ...paginationParameters
                    ],
                    responses: getOpenAPI3Responses([200, 500], { '$ref': '#/components/schemas/BlendClaim' })
                }
            },
            '/v1/blends/{contract}/{blend_id}/ingredients/{index}/assets': {
                get: {
                    tags: ['neftyblends'],
                    summary: 'Get the matching assets of an ingredient',
                    description: 'Get the assets that match an ingredient',
                    parameters: [
                        {
                            name: 'contract',
                            in: 'path',
                            description: 'Blend contract',
                            required: true,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'blend_id',
                            in: 'path',
                            description: 'Blend id',
                            required: true,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'index',
                            in: 'path',
                            description: 'Ingredient index',
                            required: true,
                            schema: {type: 'integer'}
                        },
                        {
                            name: 'owner',
                            in: 'query',
                            description: 'Filter by owner',
                            required: false,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'has_backed_tokens',
                            in: 'query',
                            description: 'Show only assets that are backed by a token',
                            required: false,
                            schema: {
                                type: 'boolean'
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
                                enum: ['asset_id', 'minted', 'updated', 'transferred', 'template_mint', 'name', 'balance_attribute'],
                                default: 'asset_id'
                            }
                        },
                    ],
                    responses: getOpenAPI3Responses([200, 500], {type: 'array', items: {'$ref': '#/components/schemas/Asset'}})
                }
            },
        }
    };
}
