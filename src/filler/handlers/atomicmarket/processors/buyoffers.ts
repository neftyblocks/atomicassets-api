import DataProcessor from '../../../processor';
import { ContractDBTransaction } from '../../../database';
import { EosioActionTrace, EosioTransaction } from '../../../../types/eosio';
import { ShipBlock } from '../../../../types/ship';
import { eosioTimestampToDate } from '../../../../utils/eosio';
import AtomicMarketHandler, { AtomicMarketUpdatePriority, BuyofferState } from '../index';
import ApiNotificationSender from '../../../notifier';
import { AcceptBuyofferActionData, CancelBuyofferActionData, DeclineBuyofferActionData, LogNewBuyofferActionData } from '../types/actions';
import { preventInt64Overflow } from '../../../../utils/binary';
import logger from '../../../../utils/winston';

export function buyofferProcessor(core: AtomicMarketHandler, processor: DataProcessor, notifier: ApiNotificationSender): () => any {
    const destructors: Array<() => any> = [];
    const contract = core.args.atomicmarket_account;

    destructors.push(processor.onActionTrace(
        contract, 'lognewbuyo',
        async (db: ContractDBTransaction, block: ShipBlock, tx: EosioTransaction, trace: EosioActionTrace<LogNewBuyofferActionData>): Promise<void> => {
            // fix issue that action could be called by a different account
            if (trace.act.authorization.find(authorization => authorization.actor !== core.args.atomicmarket_account)) {
                logger.warn('Received lognewbuyoffer from invalid authorization');

                return;
            }

            await db.insert('atomicmarket_buyoffers', {
                market_contract: core.args.atomicmarket_account,
                buyoffer_id: trace.act.data.buyoffer_id,
                buyer: trace.act.data.buyer,
                seller: trace.act.data.recipient,
                price: preventInt64Overflow(trace.act.data.price.split(' ')[0].replace('.', '')),
                token_symbol: trace.act.data.price.split(' ')[1],
                assets_contract: core.args.atomicassets_account,
                maker_marketplace: trace.act.data.maker_marketplace,
                taker_marketplace: null,
                collection_name: trace.act.data.collection_name,
                collection_fee: trace.act.data.collection_fee,
                state: BuyofferState.PENDING.valueOf(),
                memo: trace.act.data.memo,
                decline_memo: null,
                updated_at_block: block.block_num,
                updated_at_time: eosioTimestampToDate(block.timestamp).getTime(),
                created_at_block: block.block_num,
                created_at_time: eosioTimestampToDate(block.timestamp).getTime()
            }, ['market_contract', 'buyoffer_id']);

            await db.insert('atomicmarket_buyoffers_assets', trace.act.data.asset_ids.map((assetID, index) => ({
                market_contract: core.args.atomicmarket_account,
                buyoffer_id: trace.act.data.buyoffer_id,
                assets_contract: core.args.atomicassets_account,
                index: index + 1,
                asset_id: assetID
            })), ['market_contract', 'buyoffer_id', 'assets_contract', 'asset_id']);

            notifier.sendActionTrace('buyoffer', block, tx, trace);
        }, AtomicMarketUpdatePriority.ACTION_CREATE_BUYOFFER.valueOf()
    ));

    destructors.push(processor.onActionTrace(
        contract, 'cancelbuyo',
        async (db: ContractDBTransaction, block: ShipBlock, tx: EosioTransaction, trace: EosioActionTrace<CancelBuyofferActionData>): Promise<void> => {
            await db.update('atomicmarket_buyoffers', {
                state: BuyofferState.CANCELED.valueOf(),
                updated_at_block: block.block_num,
                updated_at_time: eosioTimestampToDate(block.timestamp).getTime()
            }, {
                str: 'market_contract = $1 AND buyoffer_id = $2',
                values: [core.args.atomicmarket_account, trace.act.data.buyoffer_id]
            }, ['market_contract', 'buyoffer_id']);

            notifier.sendActionTrace('buyoffer', block, tx, trace);
        }, AtomicMarketUpdatePriority.ACTION_UPDATE_BUYOFFER.valueOf()
    ));

    destructors.push(processor.onActionTrace(
        contract, 'acceptbuyo',
        async (db: ContractDBTransaction, block: ShipBlock, tx: EosioTransaction, trace: EosioActionTrace<AcceptBuyofferActionData>): Promise<void> => {
            await db.update('atomicmarket_buyoffers', {
                state: BuyofferState.ACCEPTED.valueOf(),
                taker_marketplace: trace.act.data.taker_marketplace,
                updated_at_block: block.block_num,
                updated_at_time: eosioTimestampToDate(block.timestamp).getTime()
            }, {
                str: 'market_contract = $1 AND buyoffer_id = $2',
                values: [core.args.atomicmarket_account, trace.act.data.buyoffer_id]
            }, ['market_contract', 'buyoffer_id']);

            notifier.sendActionTrace('buyoffer', block, tx, trace);
        }, AtomicMarketUpdatePriority.ACTION_UPDATE_BUYOFFER.valueOf()
    ));

    destructors.push(processor.onActionTrace(
        contract, 'declinebuyo',
        async (db: ContractDBTransaction, block: ShipBlock, tx: EosioTransaction, trace: EosioActionTrace<DeclineBuyofferActionData>): Promise<void> => {
            await db.update('atomicmarket_buyoffers', {
                state: BuyofferState.DECLINED.valueOf(),
                decline_memo: trace.act.data.decline_memo,
                updated_at_block: block.block_num,
                updated_at_time: eosioTimestampToDate(block.timestamp).getTime()
            }, {
                str: 'market_contract = $1 AND buyoffer_id = $2',
                values: [core.args.atomicmarket_account, trace.act.data.buyoffer_id]
            }, ['market_contract', 'buyoffer_id']);

            notifier.sendActionTrace('buyoffer', block, tx, trace);
        }, AtomicMarketUpdatePriority.ACTION_UPDATE_BUYOFFER.valueOf()
    ));

    return (): any => destructors.map(fn => fn());
}
