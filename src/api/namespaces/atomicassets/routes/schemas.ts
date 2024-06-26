import * as express from 'express';

import { AtomicAssetsNamespace } from '../index';
import { HTTPServer } from '../../../server';
import {
    actionGreylistParameters,
    dateBoundaryParameters,
    getOpenAPI3Responses,
    getPrimaryBoundaryParams,
    paginationParameters,
} from '../../../docs';
import { greylistFilterParameters } from '../openapi';
import {
    getSchemaAction,
    getSchemaLogsAction,
    getSchemasAction,
    getSchemasCountAction,
    getSchemaStatsAction,
    getAttributeStatsAction,
} from '../handlers/schemas';

export function schemasEndpoints(core: AtomicAssetsNamespace, server: HTTPServer, router: express.Router): any {
    const {caching, returnAsJSON} = server.web;

    router.all('/v1/schemas', caching(), returnAsJSON(getSchemasAction, core));
    router.all('/v1/schemas/_count', caching(), returnAsJSON(getSchemasCountAction, core));
    router.all('/v1/schemas/:collection_name/:schema_name', caching({ignoreQueryString: true}), returnAsJSON(getSchemaAction, core));
    router.all('/v1/schemas/:collection_name/:schema_name/attributes', caching(), returnAsJSON(getAttributeStatsAction, core));

    router.all('/v1/schemas/:collection_name/:schema_name/stats', caching({ignoreQueryString: true}), returnAsJSON(getSchemaStatsAction, core));

    router.all('/v1/schemas/:collection_name/:schema_name/logs', caching(), returnAsJSON(getSchemaLogsAction, core));

    return {
        tag: {
            name: 'schemas',
            description: 'Schemas'
        },
        paths: {
            '/v1/schemas': {
                get: {
                    tags: ['schemas'],
                    summary: 'Fetch schemas',
                    parameters: [
                        {
                            name: 'collection_name',
                            in: 'query',
                            description: 'Get all schemas within the collection',
                            required: false,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'authorized_account',
                            in: 'query',
                            description: 'Filter for schemas the provided account can edit',
                            required: false,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'schema_name',
                            in: 'query',
                            description: 'Schema name',
                            required: false,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'match',
                            in: 'query',
                            description: 'Search for input in schema name',
                            required: false,
                            schema: {type: 'string'}
                        },
                        ...greylistFilterParameters,
                        ...getPrimaryBoundaryParams('schema_name'),
                        ...dateBoundaryParameters,
                        ...paginationParameters,
                        {
                            name: 'sort',
                            in: 'query',
                            description: 'Column to sort',
                            required: false,
                            schema: {
                                type: 'string',
                                enum: ['created', 'schema_name', 'assets'],
                                default: 'created'
                            }
                        }
                    ],
                    responses: getOpenAPI3Responses([200, 500], {type: 'array', items: {'$ref': '#/components/schemas/Schema'}})
                }
            },
            '/v1/schemas/{collection_name}/{schema_name}': {
                get: {
                    tags: ['schemas'],
                    summary: 'Find schema by schema_name',
                    parameters: [
                        {
                            name: 'collection_name',
                            in: 'path',
                            description: 'Collection name of schema',
                            required: true,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'schema_name',
                            in: 'path',
                            description: 'Name of schema',
                            required: true,
                            schema: {type: 'string'}
                        }
                    ],
                    responses: getOpenAPI3Responses([200, 416, 500], {'$ref': '#/components/schemas/Schema'})
                }
            },
            '/v1/schemas/{collection_name}/{schema_name}/attributes': {
                get: {
                    tags: ['schemas'],
                    summary: 'Fetch schema attribute stats',
                    parameters: [
                        {
                            name: 'collection_name',
                            in: 'path',
                            description: 'Collection name of schema',
                            required: true,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'schema_name',
                            in: 'path',
                            description: 'Name of schema',
                            required: true,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'attributes',
                            in: 'query',
                            description: 'Filter only the selected attributes (separated by commas)',
                            required: false,
                            schema: {type: 'string'}
                        },
                    ],
                    responses: getOpenAPI3Responses([200, 416, 500], {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                attribute: {type: 'string'},
                                value: {type: 'string'},
                                occurrences: {type: 'integer'},
                                supply: {type: 'integer'}
                            }
                        }
                    })
                }
            },
            '/v1/schemas/{collection_name}/{schema_name}/stats': {
                get: {
                    tags: ['schemas'],
                    summary: 'Get stats about a specific schema',
                    parameters: [
                        {
                            name: 'collection_name',
                            in: 'path',
                            description: 'Collection name of schema',
                            required: true,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'schema_name',
                            in: 'path',
                            description: 'Name of schema',
                            required: true,
                            schema: {type: 'string'}
                        }
                    ],
                    responses: getOpenAPI3Responses([200, 500], {
                        type: 'object',
                        properties: {
                            assets: {type: 'string'},
                            burned: {type: 'string'},
                            templates: {type: 'string'}
                        }
                    })
                }
            },
            '/v1/schemas/{collection_name}/{schema_name}/logs': {
                get: {
                    tags: ['schemas'],
                    summary: 'Fetch schema logs',
                    parameters: [
                        {
                            name: 'collection_name',
                            in: 'path',
                            description: 'Collection name of schema',
                            required: true,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'schema_name',
                            in: 'path',
                            description: 'Name of schema',
                            required: true,
                            schema: {type: 'string'}
                        },
                        ...paginationParameters,
                        ...actionGreylistParameters
                    ],
                    responses: getOpenAPI3Responses([200, 500], {type: 'array', items: {'$ref': '#/components/schemas/Log'}})
                }
            }
        }
    };
}
