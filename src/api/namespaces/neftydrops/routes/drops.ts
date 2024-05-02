import * as express from 'express';

import {DropApiState, NeftyDropsNamespace} from '../index';
import { HTTPServer } from '../../../server';
import {
    dateBoundaryParameters, getOpenAPI3Responses,
    paginationParameters, primaryBoundaryParameters,
} from '../../../docs';
import {dropDataFilter, dropsFilterParameters} from '../openapi';
import {
    getDropAction,
    getDropClaimsAction,
    getDropClaimsCountAction,
    getDropsAction,
    getDropsCountAction,
    getDropsClaimableAction,
    getDropsByCollection, getDropClaimAction,
} from '../handlers/drops';
import {greylistFilterParameters} from '../../atomicassets/openapi';

export function dropsEndpoints(core: NeftyDropsNamespace, server: HTTPServer, router: express.Router): any {
    const { caching, returnAsJSON } = server.web;
    router.all('/v1/drops', caching(), returnAsJSON(getDropsAction, core));
    router.all('/v1/drops/_count', caching(), returnAsJSON(getDropsCountAction, core));
    router.all('/v1/drops_by_collection', caching(), returnAsJSON(getDropsByCollection, core));
    router.all('/v1/drops/claimable', caching(), returnAsJSON(getDropsClaimableAction, core));
    router.all('/v1/drops/:drop_id', caching(), returnAsJSON(getDropAction, core));
    router.all('/v1/drops/:drop_id/claims', caching(), returnAsJSON(getDropClaimsAction, core));
    router.all('/v1/drops/:drop_id/claims/_count', caching(), returnAsJSON(getDropClaimsCountAction, core));
    router.all('/v1/drops/:drop_id/claims/:claim_id', caching(), returnAsJSON(getDropClaimAction, core));

    return {
        tag: {
            name: 'drops',
            description: 'Drops'
        },
        paths: {
            '/v1/drops': {
                get: {
                    tags: ['drops'],
                    summary: 'Get all drops. ',
                    description: dropDataFilter,
                    parameters: [
                        {
                            name: 'symbol',
                            in: 'query',
                            description: 'Filter by symbol',
                            required: false,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'collection_name',
                            in: 'query',
                            description: 'Collection name of the drops',
                            required: false,
                            schema: {type: 'string'}
                        },
                        ...greylistFilterParameters,
                        {
                            name: 'state',
                            in: 'query',
                            description: 'Filter by drop state (' +
                                DropApiState.ACTIVE.valueOf() + ': ACTIVE - The drop is active (default), ' +
                                DropApiState.DELETED.valueOf() + ': DELETED - The drop is deleted ' +
                                DropApiState.SOLD_OUT.valueOf() + ': SOLD_OUT - The drop is sold out ' +
                                DropApiState.ENDED.valueOf() + ': ENDED - The drop is ended ' +
                                DropApiState.AVAILABLE.valueOf() + ': AVAILABLE - The drop is available for purchase' +
                                ') - separate multiple with ","',
                            required: false,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'hidden',
                            in: 'query',
                            description: 'Display hidden drops',
                            required: false,
                            schema: {type: 'boolean'}
                        },
                        {
                            name: 'secure',
                            in: 'query',
                            description: 'Filters by secure or non-secured drops',
                            required: false,
                            schema: {type: 'boolean'}
                        },
                        {
                            name: 'has_referrals_enabled',
                            in: 'query',
                            description: 'Filters by drops with or without referrals enabled',
                            required: false,
                            schema: {type: 'boolean'}
                        },
                        {
                            name: 'has_credit_card_enabled',
                            in: 'query',
                            description: 'Filters by drops with or without credit card payments enabled',
                            required: false,
                            schema: {type: 'boolean'}
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
                        {
                            name: 'sort_available_first',
                            in: 'query',
                            description: 'Displays available drops first (Not sold out)',
                            required: false,
                            schema: {type: 'boolean'}
                        },
                        ...primaryBoundaryParameters,
                        ...dropsFilterParameters,
                        ...dateBoundaryParameters,
                        ...paginationParameters,
                        {
                            name: 'sort',
                            in: 'query',
                            description: 'Column to sort',
                            required: false,
                            schema: {
                                type: 'string',
                                enum: [
                                    'created', 'updated', 'drop_id', 'price',
                                    'start_time', 'end_time', 'volume'
                                ],
                                default: 'created'
                            }
                        }
                    ],
                    responses: getOpenAPI3Responses([200, 500], {
                        type: 'array',
                        items: {'$ref': '#/components/schemas/Drop'}
                    })
                }
            },
            '/v1/drops_by_collection': {
                get: {
                    tags: ['drops'],
                    summary: 'Get drops grouped by collection. ',
                    description: dropDataFilter,
                    parameters: [
                        {
                            name: 'state',
                            in: 'query',
                            description: 'Filter by drop state (' +
                                DropApiState.ACTIVE.valueOf() + ': ACTIVE - The drop is active (default), ' +
                                DropApiState.DELETED.valueOf() + ': DELETED - The drop is deleted ' +
                                DropApiState.SOLD_OUT.valueOf() + ': SOLD_OUT - The drop is sold out ' +
                                DropApiState.ENDED.valueOf() + ': ENDED - The drop is ended ' +
                                DropApiState.AVAILABLE.valueOf() + ': AVAILABLE - The drop is available for purchase' +
                                ') - separate multiple with ","',
                            required: false,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'hidden',
                            in: 'query',
                            description: 'Display hidden drops',
                            required: false,
                            schema: {type: 'boolean'}
                        },
                        {
                            name: 'secure',
                            in: 'query',
                            description: 'Filters by secure or non-secured drops',
                            required: false,
                            schema: {type: 'boolean'}
                        },
                        {
                            name: 'has_referrals_enabled',
                            in: 'query',
                            description: 'Filters by drops with or without referrals enabled',
                            required: false,
                            schema: {type: 'boolean'}
                        },
                        {
                            name: 'has_credit_card_enabled',
                            in: 'query',
                            description: 'Filters by drops with or without credit card payments enabled',
                            required: false,
                            schema: {type: 'boolean'}
                        },
                        {
                            name: 'hide_description',
                            in: 'query',
                            description: 'Removed the drop description data from the response',
                            required: false,
                            schema: {type: 'boolean', default: true}
                        },
                        {
                            name: 'render_markdown',
                            in: 'query',
                            description: 'Renders the markdown in the description as HTML',
                            required: false,
                            schema: {type: 'boolean', default: false}
                        },
                        {
                            name: 'sort_available_first',
                            in: 'query',
                            description: 'Displays available drops first (Not sold out)',
                            required: false,
                            schema: {type: 'boolean'}
                        },
                        ...dropsFilterParameters,
                        ...dateBoundaryParameters,
                        {
                            name: 'drop_limit',
                            in: 'query',
                            description: 'Number of drops to return per collection',
                            required: false,
                            schema: {
                                type: 'integer',
                                default: 5
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
                                enum: [
                                    'created', 'updated',
                                    'start_time', 'end_time',
                                ],
                                default: 'created'
                            }
                        }
                    ],
                    responses: getOpenAPI3Responses([200, 500], {
                        type: 'array',
                        items: {'$ref': '#/components/schemas/GroupedDrop'}
                    })
                }
            },
            '/v1/drops/claimable': {
                get: {
                    tags: ['drops'],
                    summary: 'Get drops claimable by a specified wallet',
                    description: 'Filter out the drop IDs, where the wallet meets the security requirements',
                    parameters: [
                        {
                            name: 'drops',
                            in: 'query',
                            description: 'Filter drops by a list of ids - separate multiple with ","',
                            required: true,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'account',
                            in: 'query',
                            description: 'Account to verify drops pass security checks',
                            required: true,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'keys',
                            in: 'query',
                            description: 'Private keys used to verify any secured drops if any - separate multiple with ","',
                            required: false,
                            schema: {type: 'string'}
                        }
                    ],
                    responses: getOpenAPI3Responses([200, 500], {
                        type: 'object',
                        properties: {
                            drop_id: {'$ref': '#/components/schemas/ClaimableDrop'}
                        }
                    })
                }
            },
            '/v1/drops/{drop_id}': {
                get: {
                    tags: ['drops'],
                    summary: 'Get a specific drop by id',
                    parameters: [
                        {
                            in: 'path',
                            name: 'drop_id',
                            description: 'Drop Id',
                            required: true,
                            schema: {type: 'integer'}
                        },
                        {
                            name: 'render_markdown',
                            in: 'query',
                            description: 'Renders the markdown in the description as HTML',
                            required: false,
                            schema: {type: 'boolean', default: false}
                        },
                    ],
                    responses: getOpenAPI3Responses([200, 416, 500], {'$ref': '#/components/schemas/Drop'})
                }
            },
            '/v1/drops/{drop_id}/claims': {
                get: {
                    tags: ['drops'],
                    summary: 'Fetch drop claims',
                    parameters: [
                        {
                            name: 'drop_id',
                            in: 'path',
                            description: 'ID of drop',
                            required: true,
                            schema: {type: 'integer'}
                        },
                        ...paginationParameters,
                        {
                            name: 'sort',
                            in: 'query',
                            description: 'Column to sort',
                            required: false,
                            schema: {
                                type: 'string',
                                enum: [
                                    'claim_time', 'price', 'amount', 'claimer'
                                ],
                                default: 'claim_time'
                            }
                        }
                    ],
                    responses: getOpenAPI3Responses([200, 500], {type: 'array', items: {'$ref': '#/components/schemas/DropClaim'}})
                }
            },
            '/v1/drops/{drop_id}/claims/{claim_id}': {
                get: {
                    tags: ['drops'],
                    summary: 'Fetch drop claim',
                    parameters: [
                        {
                            name: 'drop_id',
                            in: 'path',
                            description: 'ID of drop',
                            required: true,
                            schema: {type: 'integer'}
                        },
                        {
                            name: 'claim_id',
                            in: 'path',
                            description: 'Claim ID',
                            required: true,
                            schema: {type: 'integer'}
                        },
                    ],
                    responses: getOpenAPI3Responses([200, 500], {'$ref': '#/components/schemas/DropClaim'})
                }
            }
        }
    };
}
