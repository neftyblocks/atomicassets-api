import * as express from 'express';

import { AtomicMarketNamespace, BuyofferApiState } from '../index';
import { HTTPServer } from '../../../server';
import { formatBuyoffer } from '../format';
import { fillBuyoffers } from '../filler';
import { buildBuyofferFilter } from '../utils';
import {
    actionGreylistParameters,
    dateBoundaryParameters,
    getOpenAPI3Responses,
    paginationParameters,
    primaryBoundaryParameters
} from '../../../docs';
import { assetFilterParameters, atomicDataFilter } from '../../atomicassets/openapi';
import logger from '../../../../utils/winston';
import { buildBoundaryFilter, filterQueryArgs } from '../../utils';
import { listingFilterParameters } from '../openapi';
import { buildGreylistFilter } from '../../atomicassets/utils';
import {
    applyActionGreylistFilters,
    createSocketApiNamespace,
    extractNotificationIdentifiers,
    getContractActionLogs
} from '../../../utils';
import ApiNotificationReceiver from '../../../notification';
import { NotificationData } from '../../../../filler/notifier';
import QueryBuilder from '../../../builder';

export function buyoffersEndpoints(core: AtomicMarketNamespace, server: HTTPServer, router: express.Router): any {
    router.all(['/v1/buyoffers', '/v1/buyoffers/_count'], server.web.caching(), async (req, res) => {
        try {
            const args = filterQueryArgs(req, {
                page: {type: 'int', min: 1, default: 1},
                limit: {type: 'int', min: 1, max: 100, default: 100},
                sort: {
                    type: 'string',
                    values: [
                        'created', 'updated', 'ending', 'buyoffer_id', 'price',
                        'template_mint'
                    ],
                    default: 'created'
                },
                order: {type: 'string', values: ['asc', 'desc'], default: 'desc'}
            });

            const query = new QueryBuilder(
                'SELECT listing.buyoffer_id ' +
                'FROM atomicmarket_buyoffers listing ' +
                'JOIN atomicmarket_tokens "token" ON (listing.market_contract = "token".market_contract AND listing.token_symbol = "token".token_symbol)'
            );

            query.equal('listing.market_contract', core.args.atomicmarket_account);
            query.addCondition(
                'NOT EXISTS (' +
                'SELECT * FROM atomicmarket_buyoffers_assets buyoffer_asset ' +
                'WHERE buyoffer_asset.market_contract = listing.market_contract AND buyoffer_asset.buyoffer_id = listing.buyoffer_id AND ' +
                '       NOT EXISTS (SELECT * FROM atomicassets_assets asset WHERE asset.contract = buyoffer_asset.assets_contract AND asset.asset_id = buyoffer_asset.asset_id)' +
                ')'
            );

            buildBuyofferFilter(req, query);
            buildGreylistFilter(req, query, {collectionName: 'listing.collection_name'});
            buildBoundaryFilter(
                req, query, 'listing.buyoffer_id', 'int',
                args.sort === 'updated' ? 'listing.updated_at_time' : 'listing.created_at_time'
            );

            if (req.originalUrl.search('/_count') >= 0) {
                const countQuery = await server.query(
                    'SELECT COUNT(*) counter FROM (' + query.buildString() + ') x',
                    query.buildValues()
                );

                return res.json({success: true, data: countQuery.rows[0].counter, query_time: Date.now()});
            }

            const sortMapping: {[key: string]: {column: string, nullable: boolean}} = {
                buyoffer_id: {column: 'listing.buyoffer_id', nullable: false},
                created: {column: 'listing.created_at_time', nullable: false},
                updated: {column: 'listing.updated_at_time', nullable: false},
                price: {column: 'listing.price', nullable: false},
                template_mint: {column: 'LOWER(listing.template_mint)', nullable: true}
            };

            query.append('ORDER BY ' + sortMapping[args.sort].column + ' ' + args.order + ' ' + (sortMapping[args.sort].nullable ? 'NULLS LAST' : '') + ', listing.buyoffer_id ASC');
            query.append('LIMIT ' + query.addVariable(args.limit) + ' OFFSET ' + query.addVariable((args.page - 1) * args.limit) + ' ');

            const buyofferResult = await server.query(query.buildString(), query.buildValues());

            const buyofferLookup: {[key: string]: any} = {};
            const result = await server.query(
                'SELECT * FROM atomicmarket_buyoffers_master WHERE market_contract = $1 AND buyoffer_id = ANY ($2)',
                [core.args.atomicmarket_account, buyofferResult.rows.map(row => row.buyoffer_id)]
            );

            result.rows.reduce((prev, current) => {
                prev[String(current.buyoffer_id)] = current;

                return prev;
            }, buyofferLookup);

            const buyoffers = await fillBuyoffers(
                server, core.args.atomicassets_account,
                buyofferResult.rows.map((row) => formatBuyoffer(buyofferLookup[String(row.buyoffer_id)]))
            );

            res.json({success: true, data: buyoffers, query_time: Date.now()});
        } catch (e) {
            res.status(500).json({success: false, message: 'Internal Server Error'});
        }
    });

    router.all('/v1/buyoffers/:buyoffer_id', server.web.caching(), async (req, res) => {
        try {
            const query = await server.query(
                'SELECT * FROM atomicmarket_buyoffers_master WHERE market_contract = $1 AND buyoffer_id = $2',
                [core.args.atomicmarket_account, req.params.buyoffer_id]
            );

            if (query.rowCount === 0) {
                res.status(416).json({success: false, message: 'Buyoffer not found'});
            } else {
                const buyoffers = await fillBuyoffers(
                    server, core.args.atomicassets_account, query.rows.map((row) => formatBuyoffer(row))
                );

                res.json({success: true, data: buyoffers[0], query_time: Date.now()});
            }
        } catch (e) {
            res.status(500).json({success: false, message: 'Internal Server Error'});
        }
    });

    router.all('/v1/buyoffers/:buyoffer_id/logs', server.web.caching(), (async (req, res) => {
        const args = filterQueryArgs(req, {
            page: {type: 'int', min: 1, default: 1},
            limit: {type: 'int', min: 1, max: 100, default: 100},
            order: {type: 'string', values: ['asc', 'desc'], default: 'asc'}
        });

        try {
            res.json({
                success: true,
                data: await getContractActionLogs(
                    server, core.args.atomicmarket_account,
                    applyActionGreylistFilters(['lognewbuyo', 'cancelbuyo', 'acceptbuyo', 'declinebuyo'], args),
                    {buyoffer_id: req.params.buyoffer_id},
                    (args.page - 1) * args.limit, args.limit, args.order
                ), query_time: Date.now()
            });
        } catch (e) {
            logger.error(e);

            return res.status(500).json({success: false, message: 'Internal Server Error'});
        }
    }));

    return {
        tag: {
            name: 'buyoffers',
            description: 'Buyoffers'
        },
        paths: {
            '/v1/buyoffers': {
                get: {
                    tags: ['buyoffers'],
                    summary: 'Get all buyoffers.',
                    description: atomicDataFilter,
                    parameters: [
                        {
                            name: 'state',
                            in: 'query',
                            description: 'Filter by buyoffer state (' +
                                BuyofferApiState.PENDING.valueOf() + ': WAITING: Buyoffer created and pending, ' +
                                BuyofferApiState.DECLINED.valueOf() + ': LISTED - Buyoffer was declined, ' +
                                BuyofferApiState.CANCELED.valueOf() + ': CANCELED - Buyoffer was canceled, ' +
                                BuyofferApiState.ACCEPTED.valueOf() + ': SOLD - Buyoffer has been sold, ' +
                                BuyofferApiState.INVALID.valueOf() + ': INVALID - Buyoffer invalid because recipient does not own all assets anymore' +
                                ') - separate multiple with ","',
                            required: false,
                            schema: {type: 'string'}
                        },
                        ...listingFilterParameters,
                        ...assetFilterParameters,
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
                                enum: [
                                    'created', 'updated', 'buyoffer_id', 'price',
                                    'template_mint'
                                ],
                                default: 'created'
                            }
                        }
                    ],
                    responses: getOpenAPI3Responses([200, 500], {
                        type: 'array',
                        items: {'$ref': '#/components/schemas/Buyoffer'}
                    })
                }
            },
            '/v1/buyoffers/{buyoffer_id}': {
                get: {
                    tags: ['buyoffers'],
                    summary: 'Get a specific buyoffer by id',
                    parameters: [
                        {
                            in: 'path',
                            name: 'buyoffer_id',
                            description: 'Buyoffer Id',
                            required: true,
                            schema: {type: 'integer'}
                        }
                    ],
                    responses: getOpenAPI3Responses([200, 416, 500], {'$ref': '#/components/schemas/Buyoffer'})
                }
            },
            '/v1/buyoffers/{buyoffer_id}/logs': {
                get: {
                    tags: ['buyoffers'],
                    summary: 'Fetch buyoffer logs',
                    parameters: [
                        {
                            name: 'buyoffer_id',
                            in: 'path',
                            description: 'ID of buyoffer',
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

export function buyofferSockets(core: AtomicMarketNamespace, server: HTTPServer, notification: ApiNotificationReceiver): void {
    const namespace = createSocketApiNamespace(server, core.path + '/v1/buyoffers');

    notification.onData('buyoffers', async (notifications: NotificationData[]) => {
        const buyofferIDs = extractNotificationIdentifiers(notifications, 'buyoffer_id');
        const query = await server.query(
            'SELECT * FROM atomicmarket_buyoffers_master WHERE market_contract = $1 AND buyoffer_id = ANY($2)',
            [core.args.atomicmarket_account, buyofferIDs]
        );

        const buyoffers = await fillBuyoffers(server, core.args.atomicassets_account, query.rows.map((row: any) => formatBuyoffer(row)));

        for (const notification of notifications) {
            if (notification.type === 'trace' && notification.data.trace) {
                const trace = notification.data.trace;

                if (trace.act.account !== core.args.atomicmarket_account) {
                    continue;
                }

                const buyofferID = (<any>trace.act.data).buyoffer_id;
                const buyoffer = buyoffers.find(row => String(row.buyoffer_id) === String(buyofferID));

                if (trace.act.name === 'lognewbuyo') {
                    namespace.emit('new_buyoffer', {
                        transaction: notification.data.tx,
                        block: notification.data.block,
                        trace: notification.data.trace,
                        buyoffer_id: buyofferID,
                        buyoffer: buyoffer
                    });
                }
            } else if (notification.type === 'fork') {
                namespace.emit('fork', {block_num: notification.data.block.block_num});
            }
        }
    });
}
