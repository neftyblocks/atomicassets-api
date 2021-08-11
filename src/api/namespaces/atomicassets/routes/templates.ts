import * as express from 'express';

import { AtomicAssetsNamespace } from '../index';
import { HTTPServer } from '../../../server';
import { buildGreylistFilter, buildDataConditions } from '../utils';
import { buildBoundaryFilter, filterQueryArgs } from '../../utils';
import { formatTemplate } from '../format';
import {
    actionGreylistParameters,
    dateBoundaryParameters,
    getOpenAPI3Responses,
    paginationParameters,
    primaryBoundaryParameters
} from '../../../docs';
import { atomicDataFilter, greylistFilterParameters } from '../openapi';
import { applyActionGreylistFilters, getContractActionLogs, respondApiError } from '../../../utils';
import QueryBuilder from '../../../builder';

export function templatesEndpoints(core: AtomicAssetsNamespace, server: HTTPServer, router: express.Router): any {
    router.all(['/v1/templates', '/v1/templates/_count'], server.web.caching(), (async (req, res) => {
        try {
            const args = filterQueryArgs(req, {
                page: {type: 'int', min: 1, default: 1},
                limit: {type: 'int', min: 1, max: 1000, default: 100},
                sort: {type: 'string', values: ['created', 'name'], default: 'created'},
                order: {type: 'string', values: ['asc', 'desc'], default: 'desc'},

                collection_name: {type: 'string', min: 1},
                schema_name: {type: 'string', min: 1},
                authorized_account: {type: 'string', min: 1, max: 12},

                issued_supply: {type: 'int', min: 0},
                min_issued_supply: {type: 'int', min: 0},
                max_issued_supply: {type: 'int', min: 0},
                has_assets: {type: 'bool'},

                max_supply: {type: 'int', min: 0},
                is_transferable: {type: 'bool'},
                is_burnable: {type: 'bool'}
            });

            const query = new QueryBuilder('SELECT "template".template_id FROM atomicassets_templates "template"');

            query.equal('"template".contract', core.args.atomicassets_account);

            buildDataConditions(req, query, {templateTable: '"template"'});

            if (args.collection_name) {
                query.equalMany('template.collection_name', args.collection_name.split(','));
            }

            if (args.schema_name) {
                query.equalMany('template.schema_name', args.schema_name.split(','));
            }

            if (typeof args.issued_supply === 'number') {
                query.equal('template.issued_supply', args.issued_supply);
            }

            if (typeof args.min_issued_supply === 'number') {
                query.addCondition('template.issued_supply >= ' + query.addVariable(args.min_issued_supply));
            }

            if (typeof args.max_issued_supply === 'number') {
                query.addCondition('template.issued_supply <= ' + query.addVariable(args.max_issued_supply));
            }

            if (args.has_assets) {
                query.addCondition(
                    'EXISTS(' +
                    'SELECT * FROM atomicassets_assets asset ' +
                    'WHERE template.contract = asset.contract AND template.template_id = asset.template_id AND owner IS NOT NULL' +
                    ')'
                );
            }

            if (typeof args.max_supply === 'number') {
                query.equal('template.max_supply', args.max_supply);
            }

            if (typeof args.is_transferable === 'boolean') {
                if (args.is_transferable) {
                    query.addCondition('template.transferable = TRUE');
                } else {
                    query.addCondition('template.transferable = FALSE');
                }
            }

            if (typeof args.is_burnable === 'boolean') {
                if (args.is_burnable) {
                    query.addCondition('template.burnable = TRUE');
                } else {
                    query.addCondition('template.burnable = FALSE');
                }
            }

            if (args.authorized_account) {
                query.addCondition(
                    'EXISTS(' +
                    'SELECT * FROM atomicassets_collections collection ' +
                    'WHERE collection.collection_name = template.collection_name AND collection.contract = template.contract ' +
                    'AND ' + query.addVariable(args.authorized_account) + ' = ANY(collection.authorized_accounts)' +
                    ')'
                );
            }

            buildBoundaryFilter(req, query, 'template.template_id', 'int', 'template.created_at_time');
            buildGreylistFilter(req, query, {collectionName: 'collection_name'});

            if (req.originalUrl.search('/_count') >= 0) {
                const countQuery = await server.query(
                    'SELECT COUNT(*) counter FROM (' + query.buildString() + ') x',
                    query.buildValues()
                );

                return res.json({success: true, data: countQuery.rows[0].counter, query_time: Date.now()});
            }

            const sortColumnMapping: {[key: string]: string} = {
                name: 'immutable_data->>\'name\'',
                created: 'template_id'
            };

            query.append('ORDER BY ' + sortColumnMapping[args.sort] + ' ' + args.order + ', template_id ASC');
            query.append('LIMIT ' + query.addVariable(args.limit) + ' OFFSET ' + query.addVariable((args.page - 1) * args.limit));

            const templateQuery = await server.query(query.buildString(), query.buildValues());

            const templateLookup: {[key: string]: any} = {};
            const result = await server.query(
                'SELECT * FROM atomicassets_templates_master WHERE contract = $1 AND template_id = ANY ($2)',
                [core.args.atomicassets_account, templateQuery.rows.map((row: any) => row.template_id)]
            );

            result.rows.reduce((prev: any, current: any) => {
                prev[String(current.template_id)] = current;

                return prev;
            }, templateLookup);

            return res.json({
                success: true,
                data: templateQuery.rows.map((row: any) => formatTemplate(templateLookup[String(row.template_id)])),
                query_time: Date.now()
            });
        } catch (error) {
            return respondApiError(res, error);
        }
    }));

    router.all('/v1/templates/:collection_name/:template_id', server.web.caching({ignoreQueryString: true}), (async (req, res) => {
        try {
            const query = await server.query(
                'SELECT * FROM atomicassets_templates_master WHERE contract = $1 AND template_id = $2 LIMIT 1',
                [core.args.atomicassets_account, req.params.template_id]
            );

            if (query.rowCount === 0) {
                return res.status(416).json({success: false, message: 'Template not found'});
            }

            return res.json({success: true, data: formatTemplate(query.rows[0]), query_time: Date.now()});
        } catch (error) {
            return respondApiError(res, error);
        }
    }));

    router.all('/v1/templates/:collection_name/:template_id/stats', server.web.caching({ignoreQueryString: true}), (async (req, res) => {
        try {
            const query = await server.query(
                `SELECT SUM(assets) AS assets, SUM(burned) AS burned
                FROM atomicassets_template_counts
                WHERE contract = $1 AND template_id = $2`,
                [core.args.atomicassets_account, req.params.template_id]
            );

            return res.json({success: true, data: {assets: query.rows[0].assets || '0', burned: query.rows[0].burned || '0'}});
        } catch (error) {
            return respondApiError(res, error);
        }
    }));

    router.all('/v1/templates/:collection_name/:template_id/logs', server.web.caching(), (async (req, res) => {
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
                    applyActionGreylistFilters(['lognewtempl', 'locktemplate'], args),
                    {collection_name: req.params.collection_name, template_id: parseInt(req.params.template_id, 10)},
                    (args.page - 1) * args.limit, args.limit, args.order
                ), query_time: Date.now()
            });
        } catch (error) {
            return respondApiError(res, error);
        }
    }));

    return {
        tag: {
            name: 'templates',
            description: 'Templates'
        },
        paths: {
            '/v1/templates': {
                get: {
                    tags: ['templates'],
                    summary: 'Fetch templates.',
                    description: atomicDataFilter,
                    parameters: [
                        {
                            name: 'collection_name',
                            in: 'query',
                            description: 'Get all templates within the collection',
                            required: false,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'schema_name',
                            in: 'query',
                            description: 'Get all templates which implement that schema',
                            required: false,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'issued_supply',
                            in: 'query',
                            description: 'Filter by issued supply',
                            required: false,
                            schema: {type: 'number'}
                        },
                        {
                            name: 'min_issued_supply',
                            in: 'query',
                            description: 'Filter by issued supply',
                            required: false,
                            schema: {type: 'number'}
                        },
                        {
                            name: 'max_issued_supply',
                            in: 'query',
                            description: 'Filter by issued supply',
                            required: false,
                            schema: {type: 'number'}
                        },
                        {
                            name: 'has_assets',
                            in: 'query',
                            description: 'Only show templates with existing supply > 0',
                            required: false,
                            schema: {type: 'boolean'}
                        },
                        {
                            name: 'max_supply',
                            in: 'query',
                            description: 'Filter by max supply',
                            required: false,
                            schema: {type: 'number'}
                        },
                        {
                            name: 'is_burnable',
                            in: 'query',
                            description: 'Filter by burnable',
                            required: false,
                            schema: {type: 'boolean'}
                        },
                        {
                            name: 'is_transferable',
                            in: 'query',
                            description: 'Filter by transferable',
                            required: false,
                            schema: {type: 'boolean'}
                        },
                        {
                            name: 'authorized_account',
                            in: 'query',
                            description: 'Filter for templates the provided account can use',
                            required: false,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'match',
                            in: 'query',
                            description: 'Search for template id or',
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
                                enum: ['name', 'created'],
                                default: 'created'
                            }
                        }
                    ],
                    responses: getOpenAPI3Responses([200, 500], {type: 'array', items: {'$ref': '#/components/schemas/Template'}})
                }
            },
            '/v1/templates/{collection_name}/{template_id}': {
                get: {
                    tags: ['templates'],
                    summary: 'Find template by id',
                    parameters: [
                        {
                            name: 'collection_name',
                            in: 'path',
                            description: 'Name of collection',
                            required: true,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'template_id',
                            in: 'path',
                            description: 'ID of template',
                            required: true,
                            schema: {type: 'integer'}
                        }
                    ],
                    responses: getOpenAPI3Responses([200, 416, 500], {'$ref': '#/components/schemas/Template'})
                }
            },
            '/v1/templates/{collection_name}/{template_id}/stats': {
                get: {
                    tags: ['templates'],
                    summary: 'Get stats about a specific template',
                    parameters: [
                        {
                            name: 'collection_name',
                            in: 'path',
                            description: 'Name of collection',
                            required: true,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'template_id',
                            in: 'path',
                            description: 'ID of template',
                            required: true,
                            schema: {type: 'integer'}
                        }
                    ],
                    responses: getOpenAPI3Responses([200, 500], {
                        type: 'object',
                        properties: {
                            assets: {type: 'string'},
                            burned: {type: 'string'}
                        }
                    })
                }
            },
            '/v1/templates/{collection_name}/{template_id}/logs': {
                get: {
                    tags: ['templates'],
                    summary: 'Fetch template logs',
                    parameters: [
                        {
                            name: 'collection_name',
                            in: 'path',
                            description: 'Name of collection',
                            required: true,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'template_id',
                            in: 'path',
                            description: 'ID of template',
                            required: true,
                            schema: {type: 'integer'}
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
