import * as express from 'express';

import { AtomicMarketNamespace, AuctionApiState } from '../index';
import { HTTPServer } from '../../../server';
import { formatAuction } from '../format';
import { fillAuctions } from '../filler';
import { buildAuctionFilter } from '../utils';
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
import { eosioTimestampToDate } from '../../../../utils/eosio';
import QueryBuilder from '../../../builder';

export function auctionsEndpoints(core: AtomicMarketNamespace, server: HTTPServer, router: express.Router): any {
    router.all(['/v1/auctions', '/v1/auctions/_count'], server.web.caching(), async (req, res) => {
        try {
            const args = filterQueryArgs(req, {
                page: {type: 'int', min: 1, default: 1},
                limit: {type: 'int', min: 1, max: 100, default: 100},
                sort: {
                    type: 'string',
                    values: [
                        'created', 'updated', 'ending', 'auction_id', 'price',
                        'template_mint'
                    ],
                    default: 'created'
                },
                order: {type: 'string', values: ['asc', 'desc'], default: 'desc'}
            });

            const query = new QueryBuilder(
                'SELECT listing.auction_id ' +
                'FROM atomicmarket_auctions listing ' +
                'JOIN atomicmarket_tokens "token" ON (listing.market_contract = "token".market_contract AND listing.token_symbol = "token".token_symbol)'
            );

            query.equal('listing.market_contract', core.args.atomicmarket_account);

            query.addCondition(
                'NOT EXISTS (' +
                'SELECT * FROM atomicmarket_auctions_assets auction_asset ' +
                'WHERE auction_asset.market_contract = listing.market_contract AND auction_asset.auction_id = listing.auction_id AND ' +
                'NOT EXISTS (SELECT * FROM atomicassets_assets asset WHERE asset.contract = auction_asset.assets_contract AND asset.asset_id = auction_asset.asset_id)' +
                ')'
            );

            buildAuctionFilter(req, query);
            buildGreylistFilter(req, query, {collectionName: 'listing.collection_name'});
            buildBoundaryFilter(
                req, query, 'listing.auction_id', 'int',
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
                auction_id: {column: 'listing.auction_id', nullable: false},
                ending: {column: 'listing.end_time', nullable: false},
                created: {column: 'listing.created_at_time', nullable: false},
                updated: {column: 'listing.updated_at_time', nullable: false},
                price: {column: 'listing.price', nullable: true},
                template_mint: {column: 'LOWER(listing.template_mint)', nullable: true}
            };

            query.append('ORDER BY ' + sortMapping[args.sort].column + ' ' + args.order + ' ' + (sortMapping[args.sort].nullable ? 'NULLS LAST' : '') + ', listing.auction_id ASC');
            query.append('LIMIT ' + query.addVariable(args.limit) + ' OFFSET ' + query.addVariable((args.page - 1) * args.limit) + ' ');

            const auctionResult = await server.query(query.buildString(), query.buildValues());

            const auctionLookup: {[key: string]: any} = {};
            const result = await server.query(
                'SELECT * FROM atomicmarket_auctions_master WHERE market_contract = $1 AND auction_id = ANY ($2)',
                [core.args.atomicmarket_account, auctionResult.rows.map(row => row.auction_id)]
            );

            result.rows.reduce((prev, current) => {
                prev[String(current.auction_id)] = current;

                return prev;
            }, auctionLookup);

            const auctions = await fillAuctions(
                server, core.args.atomicassets_account,
                auctionResult.rows.map((row) => formatAuction(auctionLookup[String(row.auction_id)]))
            );

            res.json({success: true, data: auctions, query_time: Date.now()});
        } catch (e) {
            res.status(500).json({success: false, message: 'Internal Server Error'});
        }
    });

    router.all('/v1/auctions/:auction_id', server.web.caching(), async (req, res) => {
        try {
            const query = await server.query(
                'SELECT * FROM atomicmarket_auctions_master WHERE market_contract = $1 AND auction_id = $2',
                [core.args.atomicmarket_account, req.params.auction_id]
            );

            if (query.rowCount === 0) {
                res.status(416).json({success: false, message: 'Auction not found'});
            } else {
                const auctions = await fillAuctions(
                    server, core.args.atomicassets_account, query.rows.map((row) => formatAuction(row))
                );

                res.json({success: true, data: auctions[0], query_time: Date.now()});
            }
        } catch (e) {
            res.status(500).json({success: false, message: 'Internal Server Error'});
        }
    });

    router.all('/v1/auctions/:auction_id/logs', server.web.caching(), (async (req, res) => {
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
                    applyActionGreylistFilters(['lognewauct', 'logauctstart', 'cancelauct', 'auctclaimbuy', 'auctclaimsel'], args),
                    {auction_id: req.params.auction_id},
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
            name: 'auctions',
            description: 'Auctions'
        },
        paths: {
            '/v1/auctions': {
                get: {
                    tags: ['auctions'],
                    summary: 'Get all auctions.',
                    description: atomicDataFilter,
                    parameters: [
                        {
                            name: 'state',
                            in: 'query',
                            description: 'Filter by auction state (' +
                                AuctionApiState.WAITING.valueOf() + ': WAITING: Auction created but assets were not transferred yet, ' +
                                AuctionApiState.LISTED.valueOf() + ': LISTED - Auction pending and open to bids, ' +
                                AuctionApiState.CANCELED.valueOf() + ': CANCELED - Auction was canceled, ' +
                                AuctionApiState.SOLD.valueOf() + ': SOLD - Auction has been sold, ' +
                                AuctionApiState.INVALID.valueOf() + ': INVALID - Auction ended but no bid was made' +
                                ') - separate multiple with ","',
                            required: false,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'bidder',
                            in: 'query',
                            description: 'Filter by auctions with this bidder',
                            required: false,
                            schema: {type: 'string'}
                        },
                        {
                            name: 'participant',
                            in: 'query',
                            description: 'Filter by auctions where this account participated and can still claim / bid',
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
                                    'created', 'updated', 'ending', 'auction_id', 'price',
                                    'template_mint'
                                ],
                                default: 'created'
                            }
                        }
                    ],
                    responses: getOpenAPI3Responses([200, 500], {
                        type: 'array',
                        items: {'$ref': '#/components/schemas/Auction'}
                    })
                }
            },
            '/v1/auctions/{auction_id}': {
                get: {
                    tags: ['auctions'],
                    summary: 'Get a specific auction by id',
                    parameters: [
                        {
                            in: 'path',
                            name: 'auction_id',
                            description: 'Auction Id',
                            required: true,
                            schema: {type: 'integer'}
                        }
                    ],
                    responses: getOpenAPI3Responses([200, 416, 500], {'$ref': '#/components/schemas/Auction'})
                }
            },
            '/v1/auctions/{auction_id}/logs': {
                get: {
                    tags: ['auctions'],
                    summary: 'Fetch auction logs',
                    parameters: [
                        {
                            name: 'auction_id',
                            in: 'path',
                            description: 'ID of auction',
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

export function auctionSockets(core: AtomicMarketNamespace, server: HTTPServer, notification: ApiNotificationReceiver): void {
    const namespace = createSocketApiNamespace(server, core.path + '/v1/auctions');

    notification.onData('auctions', async (notifications: NotificationData[]) => {
        const auctionIDs = extractNotificationIdentifiers(notifications, 'auction_id');
        const query = await server.query(
            'SELECT * FROM atomicmarket_auctions_master WHERE market_contract = $1 AND auction_id = ANY($2)',
            [core.args.atomicmarket_account, auctionIDs]
        );

        const auctions = await fillAuctions(server, core.args.atomicassets_account, query.rows.map((row: any) => formatAuction(row)));

        for (const notification of notifications) {
            if (notification.type === 'trace' && notification.data.trace) {
                const trace = notification.data.trace;

                if (trace.act.account !== core.args.atomicmarket_account) {
                    continue;
                }

                const auctionID = (<any>trace.act.data).auction_id;
                const auction = auctions.find(row => String(row.auction_id) === String(auctionID));

                if (trace.act.name === 'lognewauct') {
                    namespace.emit('new_auction', {
                        transaction: notification.data.tx,
                        block: notification.data.block,
                        trace: notification.data.trace,
                        auction_id: auctionID,
                        auction: auction
                    });
                } else if (trace.act.name === 'auctionbid') {
                    const amount = (<any>trace.act.data).bid.split(' ')[0].replace('.', '');
                    const bid = auction.bids.find((bid: any) => String(bid.amount) === String(amount));

                    namespace.emit('new_bid', {
                        transaction: notification.data.tx,
                        block: notification.data.block,
                        trace: notification.data.trace,
                        auction_id: auctionID,
                        bid: auction ? {
                            number: bid ? bid.number : 0,
                            account: (<any>trace.act.data).bidder,
                            amount: amount,
                            created_at_block: notification.data.block.block_num,
                            created_at_time: eosioTimestampToDate(notification.data.block.timestamp).getTime(),
                            txid: notification.data.tx.id
                        } : null,
                        auction: auction
                    });
                }
            } else if (notification.type === 'fork') {
                namespace.emit('fork', {block_num: notification.data.block.block_num});
            }
        }
    });
}
