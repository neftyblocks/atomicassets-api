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

            const tokens = core.config[contract].supported_tokens.map(row => row.sym.split(',')[1]);

            for (const token of delta.value.supported_tokens) {
                const index = tokens.indexOf(token.sym.split(',')[1]);

                if (index === -1) {
                    await db.insert('neftyblends_tokens', {
                        contract: core.args.nefty_blender_account,
                        token_contract: token.contract,
                        token_symbol: token.sym.split(',')[1],
                        token_precision: token.sym.split(',')[0]
                    }, ['contract', 'token_symbol']);
                } else {
                    tokens.splice(index, 1);
                }
            }

            if (tokens.length > 0) {
                throw new Error('NeftyBlends: Supported token removed. Should not be possible');
            }
            core.config[contract] = delta.value;
        }, BlendsUpdatePriority.TABLE_CONFIG.valueOf()
    );
};
