import WaxDaoBackerHandler, {WaxDaoBackerUpdatePriority} from '../index';
import DataProcessor from '../../../processor';
import { ContractDBTransaction } from '../../../database';
import { EosioActionTrace, EosioTransaction } from '../../../../types/eosio';
import {
    LogBackAssetActionData,
} from '../types/actions';
import { ShipBlock } from '../../../../types/ship';
import { eosioTimestampToDate, splitEosioToken } from '../../../../utils/eosio';

export function assetProcessor(core: WaxDaoBackerHandler, processor: DataProcessor): () => any {
    const destructors: Array<() => any> = [];
    const contract = core.args.atomicassets_account;
    const backerContract = core.args.waxdao_backer_account;

    destructors.push(processor.onActionTrace(
        backerContract, 'logbackasset',
        async (db: ContractDBTransaction, block: ShipBlock, tx: EosioTransaction, trace: EosioActionTrace<LogBackAssetActionData>): Promise<void> => {
            await Promise.all(trace.act.data.tokens_to_back.map(async (tokenInput) => {
                const token = splitEosioToken(tokenInput.quantity);
                const token_contract = tokenInput.token_contract;
                const backedToken = await db.query(
                    'SELECT amount FROM atomicassets_assets_backed_tokens ' +
                    'WHERE contract = $1 AND asset_id = $2 AND token_symbol = $3 AND token_contract = $4 AND custodian_contract = $5',
                    [contract, trace.act.data.asset_id, token.token_symbol, token_contract, backerContract]
                );

                if (backedToken.rowCount > 0) {
                    await db.update('atomicassets_assets_backed_tokens', {
                        amount: String(BigInt(token.amount) + BigInt(backedToken.rows[0].amount)),
                        updated_at_block: block.block_num,
                        updated_at_time: eosioTimestampToDate(block.timestamp).getTime(),
                    }, {
                        str: 'contract = $1 AND asset_id = $2 AND token_symbol = $3 AND token_contract = $4 AND custodian_contract = $5',
                        values: [contract, trace.act.data.asset_id, token.token_symbol, token_contract, backerContract]
                    }, ['contract', 'asset_id', 'token_symbol', 'token_contract', 'custodian_contract']);
                } else {
                    await db.insert('atomicassets_assets_backed_tokens', {
                        contract: contract,
                        asset_id: trace.act.data.asset_id,
                        token_symbol: token.token_symbol,
                        token_precision: token.token_precision,
                        token_contract: token_contract,
                        custodian_contract: backerContract,
                        amount: token.amount,
                        updated_at_block: block.block_num,
                        updated_at_time: eosioTimestampToDate(block.timestamp).getTime(),
                    }, ['contract', 'asset_id', 'token_symbol', 'token_contract', 'custodian_contract']);
                }
            }));
        }, WaxDaoBackerUpdatePriority.ACTION_BACK_TOKENS.valueOf()
    ));

    return (): any => destructors.map(fn => fn());
}
