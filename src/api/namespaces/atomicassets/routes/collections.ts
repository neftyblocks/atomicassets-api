import * as express from 'express';

import { AtomicAssetsNamespace } from '../index';
import { HTTPServer } from '../../../server';
import { buildBoundaryFilter, filterQueryArgs } from '../../utils';
import { buildGreylistFilter } from '../utils';
import { formatCollection } from '../format';
import {
    actionGreylistParameters,
    dateBoundaryParameters,
    getOpenAPI3Responses,
    paginationParameters,
    primaryBoundaryParameters
} from '../../../docs';
import { greylistFilterParameters } from '../openapi';
import { applyActionGreylistFilters, getContractActionLogs, respondApiError } from '../../../utils';
import QueryBuilder from '../../../builder';

export function collectionsEndpoints(core: AtomicAssetsNamespace, server: HTTPServer, router: express.Router): any {
    router.all(['/v1/collections', '/v1/collections/_count'], server.web.caching(), (async (req, res) => {
        try {
            const args = filterQueryArgs(req, {
                page: {type: 'int', min: 1, default: 1},
                limit: {type: 'int', min: 1, max: 100, default: 100},
                sort: {type: 'string', values: ['created', 'collection_name'], default: 'created'},
                order: {type: 'string', values: ['asc', 'desc'], default: 'desc'},

                author: {type: 'string', min: 1, max: 12},
                authorized_account: {type: 'string', min: 1, max: 12},
                notify_account: {type: 'string', min: 1, max: 12},

                match: {type: 'string', min: 1}
            });

            const query = new QueryBuilder('SELECT * FROM atomicassets_collections_master');

            if (args.author) {
                query.equalMany('author', args.author.split(','));
            }

            if (args.authorized_account) {
                query.addCondition(query.addVariable(args.authorized_account) + ' = ANY(authorized_accounts)');
            }

            if (args.notify_account) {
                query.addCondition(query.addVariable(args.notify_account) + ' = ANY(notify_accounts)');
            }

            if (args.match) {
                query.addCondition('POSITION(' + query.addVariable(args.match.toLowerCase()) + ' IN collection_name) > 0');
            }

            buildBoundaryFilter(req, query, 'collection_name', 'string', 'created_at_time');
            buildGreylistFilter(req, query, {collectionName: 'collection_name'});

            if (req.originalUrl.search('/_count') >= 0) {
                const countQuery = await server.query(
                    'SELECT COUNT(*) counter FROM (' + query.buildString() + ') x',
                    query.buildValues()
                );

                return res.json({success: true, data: countQuery.rows[0].counter, query_time: Date.now()});
            }

            const sortColumnMapping: {[key: string]: string} = {
                created: 'created_at_time',
                collection_name: 'collection_name'
            };

            query.append('ORDER BY ' + sortColumnMapping[args.sort] + ' ' + args.order + ', collection_name ASC');
            query.append('LIMIT ' + query.addVariable(args.limit) + ' OFFSET ' + query.addVariable((args.page - 1) * args.limit));

            const result = await server.query(query.buildString(), query.buildValues());

            return res.json({success: true, data: result.rows.map((row) => formatCollection(row)), query_time: Date.now()});
        } catch (error) {
            return respondApiError(res, error);
        }
    }));

    router.all('/v1/collections/:collection_name', server.web.caching({ignoreQueryString: true}), (async (req, res) => {
        try {
            const query = await server.query(
                'SELECT * FROM atomicassets_collections_master WHERE contract = $1 AND collection_name = $2',
                [core.args.atomicassets_account, req.params.collection_name]
            );

            if (query.rowCount === 0) {
                return res.status(416).json({success: false, message: 'Collection not found'});
            }

            return res.json({success: true, data: formatCollection(query.rows[0]), query_time: Date.now()});
        } catch (error) {
            return respondApiError(res, error);
        }
    }));

    router.all('/v1/collections/:collection_name/stats', server.web.caching({ignoreQueryString: true}), (async (req, res) => {
        try {
            const query = await server.query(
                'SELECT ' +
                '(SELECT COUNT(*) FROM atomicassets_assets WHERE contract = $1 AND collection_name = $2) assets, ' +
                '(SELECT COUNT(*) FROM atomicassets_assets WHERE contract = $1 AND collection_name = $2 AND owner IS NULL) burned, ' +
                'ARRAY(' +
                    'SELECT json_build_object(\'template_id\', template_id, \'burned\', COUNT(*)) ' +
                    'FROM atomicassets_assets ' +
                    'WHERE contract = $1 AND collection_name = $2 AND owner IS NULL GROUP BY template_id' +
                ') burned_by_template, ' +
                'ARRAY(' +
                    'SELECT json_build_object(\'schema_name\', schema_name, \'burned\', COUNT(*)) ' +
                    'FROM atomicassets_assets ' +
                    'WHERE contract = $1 AND collection_name = $2 AND owner IS NULL GROUP BY schema_name' +
                ') burned_by_schema, ' +
                '(SELECT COUNT(*) FROM atomicassets_templates WHERE contract = $1 AND collection_name = $2) templates, ' +
                '(SELECT COUNT(*) FROM atomicassets_schemas WHERE contract = $1 AND collection_name = $2) "schemas"',
                [core.args.atomicassets_account, req.params.collection_name]
            );

            return res.json({success: true, data: query.rows[0]});
        } catch (error) {
            return respondApiError(res, error);
        }
    }));

    router.all('/v1/collections/:collection_name/schemas', server.web.caching({ignoreQueryString: true}), (async (req, res) => {
        try {
            const query = await server.query(
                `SELECT schema_name FROM atomicassets_schemas "schema"
                WHERE contract = $1 AND collection_name = $2 AND EXISTS (
                    SELECT * FROM atomicassets_assets asset 
                    WHERE asset.contract = "schema".contract AND asset.collection_name = "schema".collection_name AND 
                        asset.schema_name = "schema".schema_name AND "owner" IS NOT NULL
                )`,
                [core.args.atomicassets_account, req.params.collection_name]
            );

            return res.json({success: true, data: query.rows});
        } catch (error) {
            return respondApiError(res, error);
        }
    }));

    router.all('/v1/collections/:collection_name/logs', server.web.caching(), (async (req, res) => {
        const args = filterQueryArgs(req, {
            page: {type: 'int', min: 1, default: 1},
            limit: {type: 'int', min: 1, max: 100, default: 100},
            order: {type: 'string', values: ['asc', 'desc'], default: 'asc'}
        });

        try {
            res.json({
                success: true,
                data: await getContractActionLogs(
                    server, core.args.atomicassets_account,
                    applyActionGreylistFilters(['createcol', 'addcolauth', 'forbidnotify', 'remcolauth', 'remnotifyacc', 'setmarketfee', 'setcoldata'], args),
                    {collection_name: req.params.collection_name},
                    (args.page - 1) * args.limit, args.limit, args.order
                ), query_time: Date.now()
            });
        } catch (error) {
            return respondApiError(res, error);
        }
    }));

    return {
        tag: {
            name: 'collections',
            description: 'Collections'
        },
        paths: {
            '/v1/collections': {
                get: {
                    tags: ['collections'],
                    summary: 'Fetch collections',
                    parameters: [
                        {
                            name: 'author',
                            in: 'query',
                            description: 'Get collections by author',
                            required: false,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'match',
                            in: 'query',
                            description: 'Search for input in collection name',
                            required: false,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'authorized_account',
                            in: 'query',
                            description: 'Filter for collections which the provided account can use to create assets',
                            required: false,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'notify_account',
                            in: 'query',
                            description: 'Filter for collections where the provided account is notified',
                            required: false,
                            schema: {type: 'string'}
                        },
                        ...greylistFilterParameters,
                        ...primaryBoundaryParameters,
                        ...dateBoundaryParameters,
                        ...paginationParameters,
                        {
                            name: 'sort',
                            in: 'query',
                            description: 'Column to sort',
                            required: false,
                            schema: {
                                type: 'string',
                                enum: ['created', 'collection_name'],
                                default: 'created'
                            }
                        }
                    ],
                    responses: getOpenAPI3Responses([200, 500], {type: 'array', items: {'$ref': '#/components/schemas/Collection'}})
                }
            },
            '/v1/collections/{collection_name}': {
                get: {
                    tags: ['collections'],
                    summary: 'Find collection by its name',
                    parameters: [
                        {
                            name: 'collection_name',
                            in: 'path',
                            description: 'Name of collection',
                            required: true,
                            schema: {type: 'string'}
                        }
                    ],
                    responses: getOpenAPI3Responses([200, 416, 500], {'$ref': '#/components/schemas/Collection'})
                }
            },
            '/v1/collections/{collection_name}/stats': {
                get: {
                    tags: ['collections'],
                    summary: 'Get stats about collection',
                    parameters: [
                        {
                            name: 'collection_name',
                            in: 'path',
                            description: 'Name of collection',
                            required: true,
                            schema: {type: 'string'}
                        }
                    ],
                    responses: getOpenAPI3Responses([200, 500], {
                        type: 'object',
                        properties: {
                            assets: {type: 'string'},
                            burned: {type: 'string'},
                            templates: {type: 'string'},
                            schemas: {type: 'string'}
                        }
                    })
                }
            },
            '/v1/collections/{collection_name}/logs': {
                get: {
                    tags: ['collections'],
                    summary: 'Fetch collection logs',
                    parameters: [
                        {
                            name: 'collection_name',
                            in: 'path',
                            description: 'Name of collection',
                            required: true,
                            schema: {type: 'string'}
                        },
                        ...paginationParameters,
                        ...actionGreylistParameters
                    ],
                    responses: getOpenAPI3Responses([200, 500], {type: 'array', items: {'$ref': '#/components/schemas/Log'}})
                }
            }
        },
        definitions: {}
    };
}
