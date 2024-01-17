import * as express from 'express';

import { NeftyUpgradesNamespace} from '../index';
import { HTTPServer } from '../../../server';
import {
    getOpenAPI3Responses,
    paginationParameters,
} from '../../../docs';
import {
    getIngredientOwnershipUpgradeFilter,
    getUpgradeDetails,
    getUpgradeClaimsAction,
    getUpgradeClaimsCountAction,
    getUpgradeCategories, getIngredientOwnershipUpgradeFilterCount
} from '../handlers/upgrades';
import {getUpgradeableAssets, getUpgradeIngredientAssets} from '../handlers/assets';

export function upgradesEndpoints(core: NeftyUpgradesNamespace, server: HTTPServer, router: express.Router): any {
    const { caching, returnAsJSON } = server.web;
    router.all(
        '/v1/upgrades',
        caching(),
        returnAsJSON(getIngredientOwnershipUpgradeFilter, core)
    );
    router.all(
        '/v1/upgrades/_count',
        caching(),
        returnAsJSON(getIngredientOwnershipUpgradeFilterCount, core)
    );
    router.all(
        '/v1/upgrades/categories',
        caching(),
        returnAsJSON(getUpgradeCategories, core)
    );
    router.all(
        '/v1/upgrades/:upgrade_id',
        caching(),
        returnAsJSON(getUpgradeDetails, core)
    );
    router.all(
        '/v1/upgrades/:upgrade_id/claims',
        caching(),
        returnAsJSON(getUpgradeClaimsAction, core)
    );
    router.all(
        '/v1/upgrades/:upgrade_id/claims/_count',
        caching(),
        returnAsJSON(getUpgradeClaimsCountAction, core)
    );

    router.all(
        '/v1/upgrades/:upgrade_id/ingredients/:index/assets',
        caching(),
        returnAsJSON(getUpgradeIngredientAssets, core)
    );

    router.all(
        '/v1/upgrades/:upgrade_id/specs/:index/assets',
        caching(),
        returnAsJSON(getUpgradeableAssets, core)
    );

    return {
        tag: {
            name: 'neftyupgrades',
            description: 'NeftyUpgrades'
        },
        paths: {
            '/v1/upgrades': {
                get: {
                    tags: ['neftyupgrades'],
                    summary: 'Get upgrades that a given collector has ingredients to',
                    description:
                        'Given a collection and an ingredient_owner, returns all ' +
                        'the upgrades that both: are in that collection and that the ' +
                        'ingredient_owner owns any or all ingredients to',
                    parameters: [
                        {
                            name: 'collection_name',
                            in: 'query',
                            description: 'Collection name of upgrades',
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
                            description: 'How many ingredients should be matched in each upgrade (all or any)',
                            required: false,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'available_only',
                            in: 'query',
                            description: 'If true, it filters out all the upgrades that haven\'t started or have already ended',
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
                        {
                            name: 'search',
                            in: 'query',
                            description: 'Search for input in the results',
                            required: false,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'sort_available_first',
                            in: 'query',
                            description: 'Displays available upgrades first (Not sold out)',
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
                                enum: ['upgrade_id', 'created_at_time'],
                                default: 'upgrade_id'
                            }
                        },
                    ],
                    responses: getOpenAPI3Responses([200, 500], {
                        type: 'array',
                        items: {'$ref': '#/components/schemas/UpgradeDetails'}
                    })
                }
            },
            '/v1/upgrades/categories': {
                get: {
                    tags: ['neftyupgrades'],
                    summary: 'Get the categories assigned to upgrades',
                    description:
                        'Returns all the categories assigned to upgrades. They can be filtered by collection.',
                    parameters: [
                        {
                            name: 'collection_name',
                            in: 'query',
                            description: 'Collection name of upgrades',
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
                                enum: ['category'],
                                default: 'category'
                            }
                        },
                    ],
                    responses: getOpenAPI3Responses([200, 500], {
                        type: 'array',
                        items: {'$ref': '#/components/schemas/UpgradeDetails'}
                    })
                }
            },
            '/v1/upgrades/{upgrade_id}': {
                get: {
                    tags: ['neftyupgrades'],
                    summary: 'Get upgrade details',
                    description: 'Get details of a single upgrade',
                    parameters: [
                        {
                            name: 'upgrade_id',
                            in: 'path',
                            description: 'Upgrade id',
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
                    responses: getOpenAPI3Responses([200, 500], { '$ref': '#/components/schemas/UpgradeDetails' })
                }
            },
            '/v1/upgrades/{upgrade_id}/claims': {
                get: {
                    tags: ['neftyupgrades'],
                    summary: 'Get upgrade claims',
                    description: 'Get claims of a single upgrade',
                    parameters: [
                        {
                            name: 'upgrade_id',
                            in: 'path',
                            description: 'Upgrade id',
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
                        ...paginationParameters,
                        {
                            name: 'sort',
                            in: 'query',
                            description: 'Column to sort',
                            required: false,
                            schema: {
                                type: 'string',
                                enum: ['claim_time', 'created_at_time', 'claimer'],
                                default: 'upgrade_id'
                            }
                        },
                    ],
                    responses: getOpenAPI3Responses([200, 500], { '$ref': '#/components/schemas/UpgradeClaim' })
                }
            },
            '/v1/upgrades/{upgrade_id}/ingredients/{index}/assets': {
                get: {
                    tags: ['neftyupgrades'],
                    summary: 'Get the matching assets of an ingredient',
                    description: 'Get the assets that match an ingredient',
                    parameters: [
                        {
                            name: 'upgrade_id',
                            in: 'path',
                            description: 'Upgrade id',
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
            '/v1/upgrades/{upgrade_id}/specs/{index}/assets': {
                get: {
                    tags: ['neftyupgrades'],
                    summary: 'Get the matching assets of an upgrade spec',
                    description: 'Get the assets that match an upgrade spec',
                    parameters: [
                        {
                            name: 'upgrade_id',
                            in: 'path',
                            description: 'Upgrade id',
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
                                enum: ['asset_id', 'minted', 'updated', 'transferred', 'template_mint', 'name'],
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
