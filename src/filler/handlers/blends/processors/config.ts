import DataProcessor from '../../../processor';
import { ContractDBTransaction } from '../../../database';
import { EosioContractRow } from '../../../../types/eosio';
import { ShipBlock } from '../../../../types/ship';
import { ConfigTableRow } from '../types/tables';
import BlendsHandler, { BlendsUpdatePriority } from '../index';

export function configProcessor(core: BlendsHandler, processor: DataProcessor): () => any {
    const destructors: Array<() => any> = [];
    const contract = core.args.nefty_blender_account;
    const launchContract = core.args.launch_account;

    destructors.push(getDestructor(core, processor, contract));

    if (launchContract) {
        destructors.push(getDestructor(core, processor, launchContract));
    }

    return (): any => destructors.map(fn => fn());
}

const getDestructor = (core: BlendsHandler, processor: DataProcessor, contract: string ): () => any => {
    return processor.onContractRow(
        contract, 'config',
        async (db: ContractDBTransaction, block: ShipBlock, delta: EosioContractRow<ConfigTableRow>): Promise<void> => {
            if (!delta.present) {
                throw Error('NeftyBlends: Config should not be deleted');
            }

            await db.update('neftyblends_config', {
                fee: delta.value.fee,
                fee_recipient: delta.value.fee_recipient,
            }, {
                str: 'contract = $1',
                values: [contract]
            }, ['contract']);

            const newTokens = delta.value.supported_tokens.filter(token => core.config[contract].supported_tokens.find(t => t.sym !== token.sym || t.contract !== token.contract));
            const deletedTokens = core.config[contract].supported_tokens.filter(token => delta.value.supported_tokens.find(t => t.sym !== token.sym || t.contract !== token.contract));

            for (const token of deletedTokens) {
                await db.delete('neftyblends_tokens', {
                    str: 'contract = $1 AND token_symbol = $2',
                    values: [contract, token.sym.split(',')[1]]
                });
            }

            for (const token of newTokens) {
                await db.insert('neftyblends_tokens', {
                    contract: contract,
                    token_contract: token.contract,
                    token_symbol: token.sym.split(',')[1],
                    token_precision: token.sym.split(',')[0]
                }, ['contract', 'token_symbol']);
            }

            core.config[contract] = delta.value;
        }, BlendsUpdatePriority.TABLE_CONFIG.valueOf()
    );
};
