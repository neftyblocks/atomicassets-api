import * as express from 'express';

import { AtomicAssetsNamespace } from '../index';
import { HTTPServer } from '../../../server';
import { buildBoundaryFilter, filterQueryArgs } from '../../utils';
import { FillerHook, fillTransfers } from '../filler';
import { dateBoundaryParameters, getOpenAPI3Responses, paginationParameters, primaryBoundaryParameters } from '../../../docs';
import { greylistFilterParameters } from '../openapi';
import ApiNotificationReceiver from '../../../notification';
import { createSocketApiNamespace, respondApiError } from '../../../utils';
import { NotificationData } from '../../../../filler/notifier';
import { buildAssetFilter, hasAssetFilter } from '../utils';
import QueryBuilder from '../../../builder';

export class TransferApi {
    constructor(
        readonly core: AtomicAssetsNamespace,
        readonly server: HTTPServer,
        readonly schema: string,
        readonly transferView: string,
        readonly transferFormatter: (_: any) => any,
        readonly assetView: string,
        readonly assetFormatter: (_: any) => any,
        readonly fillerHook?: FillerHook
    ) { }

    endpoints(router: express.Router): any {
        router.all(['/v1/transfers', '/v1/transfers/_count'], this.server.web.caching(), (async (req, res) => {
            try {
                const args = filterQueryArgs(req, {
                    page: {type: 'int', min: 1, default: 1},
                    limit: {type: 'int', min: 1, max: 100, default: 100},
                    sort: {type: 'string', values: ['created'], default: 'created'},
                    order: {type: 'string', values: ['asc', 'desc'], default: 'desc'},

                    asset_id: {type: 'string', min: 1},

                    collection_blacklist: {type: 'string', min: 1},
                    collection_whitelist: {type: 'string', min: 1},

                    account: {type: 'string', min: 1},
                    sender: {type: 'string', min: 1},
                    recipient: {type: 'string', min: 1},

                    hide_contracts: {type: 'bool'}
                });

                const query = new QueryBuilder('SELECT * FROM ' + this.transferView + ' transfer');
                query.equal('contract', this.core.args.atomicassets_account);

                if (args.account) {
                    const varName = query.addVariable(args.account.split(','));
                    query.addCondition('(sender_name = ANY (' + varName + ') OR recipient_name = ANY (' + varName + '))');
                }

                if (args.sender) {
                    query.equalMany('sender_name', args.sender.split(','));
                }

                if (args.recipient) {
                    query.equalMany('recipient_name', args.recipient.split(','));
                }

                if (hasAssetFilter(req, ['asset_id'])) {
                    const assetQuery = new QueryBuilder('SELECT * FROM atomicassets_transfers_assets transfer_asset, atomicassets_assets asset', query.buildValues());

                    assetQuery.join('asset', 'transfer_asset', ['contract', 'asset_id']);
                    assetQuery.join('transfer_asset', 'transfer', ['contract', 'transfer_id']);

                    buildAssetFilter(req, assetQuery, {assetTable: '"asset"', allowDataFilter: false});

                    query.addCondition('EXISTS(' + assetQuery.buildString() + ')');
                    query.setVars(assetQuery.buildValues());
                }

                if (args.asset_id) {
                    query.addCondition(
                        'EXISTS(' +
                        'SELECT * FROM atomicassets_transfers_assets asset ' +
                        'WHERE transfer.contract = asset.contract AND transfer.transfer_id = asset.transfer_id AND ' +
                        'asset_id = ANY (' + query.addVariable(args.asset_id.split(',')) + ')' +
                        ') '
                    );
                }

                if (args.collection_blacklist) {
                    query.addCondition(
                        'NOT EXISTS(' +
                        'SELECT * FROM atomicassets_transfers_assets transfer_asset, atomicassets_assets asset ' +
                        'WHERE transfer_asset.contract = transfer.contract AND transfer_asset.transfer_id = transfer.transfer_id AND ' +
                        'transfer_asset.contract = asset.contract AND transfer_asset.asset_id = asset.asset_id AND ' +
                        'asset.collection_name = ANY (' + query.addVariable(args.collection_blacklist.split(',')) + ')' +
                        ') '
                    );
                }

                if (args.collection_whitelist) {
                    query.addCondition(
                        'NOT EXISTS(' +
                        'SELECT * FROM atomicassets_transfers_assets transfer_asset, atomicassets_assets asset ' +
                        'WHERE transfer_asset.contract = transfer.contract AND transfer_asset.transfer_id = transfer.transfer_id AND ' +
                        'transfer_asset.contract = asset.contract AND transfer_asset.asset_id = asset.asset_id AND ' +
                        'NOT (asset.collection_name = ANY (' + query.addVariable(args.collection_whitelist.split(',')) + '))' +
                        ')'
                    );
                }

                if (args.hide_contracts) {
                    query.addCondition(
                        'NOT EXISTS(SELECT * FROM contract_codes ' +
                        'WHERE (account = transfer.recipient_name OR account = transfer.sender_name) AND NOT (account = ANY(' +
                        query.addVariable([args.account, args.sender, args.recipient].filter(row => !!row)) +
                        ')))'
                    );
                }

                buildBoundaryFilter(req, query, 'transfer_id', 'int', 'created_at_time');

                if (req.originalUrl.search('/_count') >= 0) {
                    const countQuery = await this.server.query(
                        'SELECT COUNT(*) counter FROM (' + query.buildString() + ') x',
                        query.buildValues()
                    );

                    return res.json({success: true, data: countQuery.rows[0].counter, query_time: Date.now()});
                }

                const sortColumnMapping: {[key: string]: string} = {
                    created: 'transfer_id'
                };

                query.append('ORDER BY ' + sortColumnMapping[args.sort] + ' ' + args.order);
                query.append('LIMIT ' + query.addVariable(args.limit) + ' OFFSET ' + query.addVariable((args.page - 1) * args.limit) + ' ');

                const result = await this.server.query(query.buildString(), query.buildValues());
                const transfers = await fillTransfers(
                    this.server, this.core.args.atomicassets_account,
                    result.rows.map((row) => this.transferFormatter(row)),
                    this.assetFormatter, this.assetView, this.fillerHook
                );

                return res.json({success: true, data: transfers, query_time: Date.now()});
            } catch (error) {
                return respondApiError(res, error);
            }
        }));

        return {
            tag: {
                name: 'transfers',
                description: 'Transfers'
            },
            paths: {
                '/v1/transfers': {
                    get: {
                        tags: ['transfers'],
                        summary: 'Fetch transfers',
                        parameters: [
                            {
                                name: 'account',
                                in: 'query',
                                description: 'Notified account (can be sender or recipient) - separate multiple with ","',
                                required: false,
                                schema: {type: 'string'}
                            },
                            {
                                name: 'sender',
                                in: 'query',
                                description: 'Transfer sender - separate multiple with ","',
                                required: false,
                                schema: {type: 'string'}
                            },
                            {
                                name: 'recipient',
                                in: 'query',
                                description: 'Transfer recipient - separate multiple with ","',
                                required: false,
                                schema: {type: 'string'}
                            },
                            {
                                name: 'asset_id',
                                in: 'query',
                                description: 'only transfers which contain this asset_id - separate multiple with ","',
                                required: false,
                                schema: {type: 'string'}
                            },
                            {
                                name: 'template_id',
                                in: 'query',
                                description: 'only transfers which contain assets of this template - separate multiple with ","',
                                required: false,
                                schema: {type: 'string'}
                            },
                            {
                                name: 'schema_name',
                                in: 'query',
                                description: 'only transfers which contain assets of this schema - separate multiple with ","',
                                required: false,
                                schema: {type: 'string'}
                            },
                            {
                                name: 'collection_name',
                                in: 'query',
                                description: 'only transfers which contain assets of this collection - separate multiple with ","',
                                required: false,
                                schema: {type: 'string'}
                            },
                            {
                                name: 'hide_contracts',
                                in: 'query',
                                description: 'dont show transfers from or to accounts that have code deployed',
                                required: false,
                                schema: {type: 'boolean'}
                            },
                            ...primaryBoundaryParameters,
                            ...dateBoundaryParameters,
                            ...greylistFilterParameters,
                            ...paginationParameters,
                            {
                                name: 'sort',
                                in: 'query',
                                description: 'Column to sort',
                                required: false,
                                schema: {
                                    type: 'string',
                                    enum: ['created'],
                                    default: 'created'
                                }
                            }
                        ],
                        responses: getOpenAPI3Responses([200, 500], {type: 'array', items: {'$ref': '#/components/schemas/' + this.schema}})
                    }
                }
            }
        };
    }

    sockets(notification: ApiNotificationReceiver): void {
        const namespace = createSocketApiNamespace(this.server, this.core.path + '/v1/offers');

        notification.onData('transfers', async (notifications: NotificationData[]) => {
            const transferIDs = notifications.filter(row => row.type === 'trace').map(row => row.data.trace.global_sequence);
            const query = await this.server.query(
                'SELECT * FROM ' + this.transferView + ' WHERE contract = $1 AND transfer_id = ANY($2)',
                [this.core.args.atomicassets_account, transferIDs]
            );

            const transfers = await fillTransfers(
                this.server, this.core.args.atomicassets_account,
                query.rows.map((row) => this.transferFormatter(row)),
                this.assetFormatter, this.assetView, this.fillerHook
            );

            for (const notification of notifications) {
                if (notification.type === 'trace' && notification.data.trace) {
                    const trace = notification.data.trace;

                    if (trace.act.account !== this.core.args.atomicassets_account) {
                        continue;
                    }

                    if (trace.act.name === 'logtransfer') {
                        namespace.emit('new_transfer', {
                            transaction: notification.data.tx,
                            block: notification.data.block,
                            trace: trace,
                            transfer_id: trace.global_sequence,
                            transfer: transfers.find(row => String(row.transfer_id) === String(trace.global_sequence))
                        });
                    }
                } else if (notification.type === 'fork') {
                    namespace.emit('fork', {block_num: notification.data.block.block_num});
                }
            }
        });
    }
}
