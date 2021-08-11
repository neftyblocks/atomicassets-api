import * as express from 'express';

import { AtomicMarketNamespace } from '../index';
import { HTTPServer } from '../../../server';
import { getOpenAPI3Responses } from '../../../docs';
import { respondApiError } from '../../../utils';

export function marketplacesEndpoints(core: AtomicMarketNamespace, server: HTTPServer, router: express.Router): any {
    router.all('/v1/marketplaces', server.web.caching(), async (_, res) => {
        try {
            const query = await server.query(
                'SELECT marketplace_name, creator, created_at_block, created_at_time FROM atomicmarket_marketplaces WHERE market_contract = $1',
                [core.args.atomicmarket_account]
            );

            res.json({success: true, data: query.rows, query_time: Date.now()});
        } catch (error) {
            return respondApiError(res, error);
        }
    });

    router.all('/v1/marketplaces/:name', server.web.caching(), async (req, res) => {
        try {
            const query = await server.query(
                'SELECT marketplace_name, creator, created_at_block, created_at_time FROM atomicmarket_marketplaces WHERE market_contract = $1 AND marketplace_name = $2',
                [core.args.atomicmarket_account, req.params.name]
            );

            if (query.rowCount === 0) {
                res.status(416).json({success: false, message: 'Marketplace not found'});
            } else {
                res.json({success: true, data: query.rows[0], query_time: Date.now()});
            }
        } catch (error) {
            return respondApiError(res, error);
        }

    });

    return {
        tag: {
            name: 'marketplaces',
            description: 'Marketplaces'
        },
        paths: {
            '/v1/marketplaces': {
                get: {
                    tags: ['marketplaces'],
                    summary: 'Get all registered marketplaces',
                    responses: getOpenAPI3Responses([200], {
                        type: 'array',
                        items: {'$ref': '#/components/schemas/Marketplace'}
                    })
                }
            },
            '/v1/marketplaces/{marketplace_name}': {
                get: {
                    tags: ['marketplaces'],
                    summary: 'Get atomicmarket config',
                    parameters: [
                        {
                            in: 'path',
                            name: 'marketplace_name',
                            description: 'Marketplace name',
                            required: true,
                            schema: {type: 'string'}
                        }
                    ],
                    responses: getOpenAPI3Responses([200, 416, 500], {'$ref': '#/components/schemas/Marketplace'})
                }
            }
        }
    };
}
