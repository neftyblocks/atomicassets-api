import DataProcessor from '../../../processor';
import { ContractDBTransaction } from '../../../database';
import { EosioContractRow } from '../../../../types/eosio';
import { ShipBlock } from '../../../../types/ship';
import { ConfigTableRow } from '../types/tables';
import UpgradesHandler, { UpgradesUpdatePriority } from '../index';

export function configProcessor(core: UpgradesHandler, processor: DataProcessor): () => any {
    const destructors: Array<() => any> = [];
    const contract = core.args.upgrades_account;

    destructors.push(processor.onContractRow(
        contract, 'config',
        async (db: ContractDBTransaction, block: ShipBlock, delta: EosioContractRow<ConfigTableRow>): Promise<void> => {
            if (!delta.present) {
                throw Error('Upgrades: Config should not be deleted');
            }

            await db.update('neftyupgrades_config', {
                fee: delta.value.fee,
                fee_recipient: delta.value.fee_recipient,
            }, {
                str: 'contract = $1',
                values: [core.args.upgrades_account]
            }, ['contract']);

            const tokens = core.config.supported_tokens.map(row => row.sym.split(',')[1]);

            for (const token of delta.value.supported_tokens) {
                const index = tokens.indexOf(token.sym.split(',')[1]);

                if (index === -1) {
                    await db.insert('neftyupgrades_tokens', {
                        contract: core.args.upgrades_account,
                        token_contract: token.contract,
                        token_symbol: token.sym.split(',')[1],
                        token_precision: token.sym.split(',')[0]
                    }, ['contract', 'token_symbol']);
                } else {
                    tokens.splice(index, 1);
                }
            }

            if (tokens.length > 0) {
                throw new Error('Upgrades: Supported token removed. Should not be possible');
            }
            core.config = delta.value;
        }, UpgradesUpdatePriority.TABLE_CONFIG.valueOf()
    ));

    return (): any => destructors.map(fn => fn());
}
