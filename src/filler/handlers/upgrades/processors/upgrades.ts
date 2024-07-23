import DataProcessor from '../../../processor';
import { ContractDBTransaction } from '../../../database';
import { EosioActionTrace, EosioContractRow, EosioTransaction } from '../../../../types/eosio';
import { ShipBlock } from '../../../../types/ship';
import {eosioTimestampToDate, stringToDisplayData} from '../../../../utils/eosio';
import UpgradesListHandler, {UpgradeIngredientType, UpgradesArgs, UpgradesUpdatePriority} from '../index';
import ConnectionManager from '../../../../connections/manager';
import {
    UpgradeSpec,
    UpgradeTableRow
} from '../types/tables';
import { Ingredient } from '../types/helpers';
import {
    bulkInsert,
    encodeDatabaseArray,
    encodeDatabaseJson,
    getAllRowsFromTable
} from '../../../utils';
import {
    LogClaimActionData,
    SetUpgradeMixActionData
} from '../types/actions';
import { preventInt64Overflow } from '../../../../utils/binary';
import UpgradesHandler from '../index';
import {BlendIngredientType} from '../../blends';

const fillUpgrades = async (args: UpgradesArgs, connection: ConnectionManager, contract: string): Promise<void> => {
    const upgradesCount = await connection.database.query(
        'SELECT COUNT(*) FROM neftyupgrades_upgrades WHERE contract = $1',
        [contract]
    );

    if (Number(upgradesCount.rows[0].count) === 0) {
        const upgradesTable = await getAllRowsFromTable(connection.chain.rpc, {
            json: true, code: contract,
            scope: contract, table: 'upgrades'
        }, 1000) as UpgradeTableRow[];

        const dbMaps = upgradesTable.map(upgrade => getUpgradeDbRows(upgrade, args, null, null, contract));

        const upgradeRows = [];
        let ingredientRows: any[] = [];
        let ingredientAttributesRows: any[] = [];
        let ingredientTypedAttributesRows: any[] = [];
        let upgradeSpecsRows: any[] = [];
        let upgradeRequirementsRows: any[] = [];
        let upgradeResultsRows: any[] = [];
        for (const {
            upgradeDbRow,
            ingredientDbRows,
            ingredientAttributesDbRows,
            ingredientTypedAttributesDbRows,
            upgradeSpecsDbRows,
            upgradeRequirementsDbRows,
            upgradeResultsDbRows
        } of dbMaps) {
            upgradeRows.push(upgradeDbRow);
            ingredientRows = ingredientRows.concat(ingredientDbRows);
            ingredientAttributesRows = ingredientAttributesRows.concat(ingredientAttributesDbRows);
            ingredientTypedAttributesRows = ingredientTypedAttributesRows.concat(ingredientTypedAttributesDbRows);
            upgradeSpecsRows = upgradeSpecsRows.concat(upgradeSpecsDbRows);
            upgradeRequirementsRows = upgradeRequirementsRows.concat(upgradeRequirementsDbRows);
            upgradeResultsRows = upgradeResultsRows.concat(upgradeResultsDbRows);
        }

        if (upgradeRows.length > 0) {
            await bulkInsert(connection.database, 'neftyupgrades_upgrades', upgradeRows);
        }
        if (ingredientRows.length > 0) {
            await bulkInsert(connection.database, 'neftyupgrades_upgrade_ingredients', ingredientRows);
        }
        if (ingredientAttributesRows.length > 0) {
            await bulkInsert(connection.database, 'neftyupgrades_upgrade_ingredient_attributes', ingredientAttributesRows);
        }
        if (ingredientTypedAttributesRows.length > 0) {
            await bulkInsert(connection.database, 'neftyupgrades_upgrade_ingredient_typed_attributes', ingredientTypedAttributesRows);
        }
        if (upgradeSpecsRows.length > 0) {
            await bulkInsert(connection.database, 'neftyupgrades_upgrade_specs', upgradeSpecsRows);
        }
        if (upgradeRequirementsRows.length > 0) {
            await bulkInsert(connection.database, 'neftyupgrades_upgrade_specs_requirements', upgradeRequirementsRows);
        }
        if (upgradeResultsRows.length > 0) {
            await bulkInsert(connection.database, 'neftyupgrades_upgrade_specs_results', upgradeResultsRows);
        }
    }
};

export async function initUpgrades(args: UpgradesArgs, connection: ConnectionManager): Promise<void> {
    await fillUpgrades(args, connection, args.upgrades_account);
}

const upgradesTableListener = (core: UpgradesListHandler, contract: string) => async (db: ContractDBTransaction, block: ShipBlock, delta: EosioContractRow<UpgradeTableRow>): Promise<void> => {
    const upgrade = await db.query(
        'SELECT upgrade_id FROM neftyupgrades_upgrades WHERE contract = $1 AND upgrade_id = $2',
        [contract, delta.value.upgrade_id]
    );

    if (!delta.present) {
        const deleteString = 'contract = $1 AND upgrade_id = $2';
        const deleteValues = [contract, delta.value.upgrade_id];
        await deleteUpgradeSpecs(db, delta.value.upgrade_id, contract);
        await db.delete('neftyupgrades_upgrade_specs_requirements', {
            str: 'contract = $1 AND upgrade_id = $2',
            values: [contract, delta.value.upgrade_id],
        });
        await db.delete('neftyupgrades_upgrade_specs_results', {
            str: 'contract = $1 AND upgrade_id = $2',
            values: [contract, delta.value.upgrade_id],
        });
        await db.delete('neftyupgrades_upgrade_specs', {
            str: 'contract = $1 AND upgrade_id = $2',
            values: [contract, delta.value.upgrade_id],
        });
        await db.delete('neftyupgrades_upgrade_ingredient_attributes', {
            str: deleteString,
            values: deleteValues,
        });
        await db.delete('neftyupgrades_upgrade_ingredient_typed_attributes', {
            str: deleteString,
            values: deleteValues,
        });
        await db.delete('neftyupgrades_upgrade_ingredients', {
            str: deleteString,
            values: deleteValues,
        });
        await db.delete('neftyupgrades_upgrades', {
            str: deleteString,
            values: deleteValues,
        });
    } else if (upgrade.rowCount === 0) {
        const {
            upgradeDbRow,
            ingredientDbRows,
            ingredientAttributesDbRows,
            ingredientTypedAttributesDbRows,
            upgradeSpecsDbRows,
            upgradeRequirementsDbRows,
            upgradeResultsDbRows
        } = getUpgradeDbRows(
            delta.value, core.args, block.block_num, block.timestamp, contract
        );
        await db.insert('neftyupgrades_upgrades', upgradeDbRow, ['contract', 'upgrade_id']);

        if (ingredientDbRows.length > 0) {
            await insertUpgradeIngredients(
                db,
                ingredientDbRows,
                ingredientAttributesDbRows,
                ingredientTypedAttributesDbRows
            );
        }
        if (upgradeSpecsDbRows.length > 0) {
            await db.insert(
                'neftyupgrades_upgrade_specs',
                upgradeSpecsDbRows,
                ['contract', 'upgrade_id', 'spec_index']
            );
        }
        if (upgradeRequirementsDbRows.length > 0) {
            await db.insert(
                'neftyupgrades_upgrade_specs_requirements',
                upgradeRequirementsDbRows,
                ['contract', 'upgrade_id', 'spec_index', 'requirement_index']
            );
        }
        if (upgradeResultsDbRows.length > 0) {
            await db.insert(
                'neftyupgrades_upgrade_specs_results',
                upgradeResultsDbRows,
                ['contract', 'upgrade_id', 'spec_index', 'result_index']
            );
        }
    } else {
        const displayData = stringToDisplayData(delta.value.display_data);

        await db.update('neftyupgrades_upgrades', {
            start_time: delta.value.start_time * 1000,
            end_time: delta.value.end_time * 1000,
            max: delta.value.max,
            use_count: delta.value.use_count,
            name: displayData.name || '',
            display_data: delta.value.display_data,
            updated_at_block: block.block_num,
            updated_at_time: eosioTimestampToDate(block.timestamp).getTime(),
            is_hidden: delta.value.is_hidden || false,
            security_id: delta.value.security_id || 0,
            category: delta.value.category || '',
        }, {
            str: 'contract = $1 AND upgrade_id = $2',
            values: [contract, delta.value.upgrade_id]
        }, ['contract', 'upgrade_id']);
    }
};

const upgradesMixListener = (core: UpgradesListHandler, contract: string) => async (db: ContractDBTransaction, block: ShipBlock, tx: EosioTransaction, trace: EosioActionTrace<SetUpgradeMixActionData>): Promise<void> => {
    const upgrades = await db.query(
        'SELECT * FROM neftyupgrades_upgrades WHERE contract = $1 AND upgrade_id = $2',
        [contract, trace.act.data.upgrade_id]
    );
    if (upgrades.rowCount === 0) {
        return;
    }
    const upgrade = upgrades.rows[0];
    const ingredients = getUpgradeIngredients(trace.act.data.ingredients, upgrade.collection_name);
    const { ingredientDbRows, ingredientAttributesDbRows, ingredientTypedAttributesDbRows } = getIngredientsDbRows(
        trace.act.data.upgrade_id,
        ingredients,
        core.args,
        block.block_num,
        block.timestamp, contract
    );

    await deleteUpgradeIngredients(
        db,
        trace.act.data.upgrade_id,
        contract,
    );
    await insertUpgradeIngredients(
        db,
        ingredientDbRows,
        ingredientAttributesDbRows,
        ingredientTypedAttributesDbRows,
    );
};

const logClaimListener = (core: UpgradesHandler, contract: string) => async (db: ContractDBTransaction, block: ShipBlock, tx: EosioTransaction, trace: EosioActionTrace<LogClaimActionData>): Promise<void> => {
    await db.insert('neftyupgrades_claims', {
            contract,
            claim_id: trace.act.data.claim_id,
            claimer: trace.act.data.claimer,
            upgrade_id: trace.act.data.upgrade_id,
            mutations: encodeDatabaseJson(trace.act.data.mutations),
            txid: Buffer.from(tx.id, 'hex'),
            transferred_assets: trace.act.data.transferred_assets,
            own_assets: trace.act.data.own_assets,
            created_at_block: block.block_num,
            created_at_time: eosioTimestampToDate(block.timestamp).getTime(),
            updated_at_block: block.block_num,
            updated_at_time: eosioTimestampToDate(block.timestamp).getTime()
        },
        ['contract', 'claim_id']
    );
};

export function upgradesProcessor(core: UpgradesListHandler, processor: DataProcessor): () => any {
    const destructors: Array<() => any> = [];
    const contract = core.args.upgrades_account;

    destructors.push(processor.onContractRow(
        contract, 'upgrades',
        upgradesTableListener(core, contract),
        UpgradesUpdatePriority.TABLE_UPGRADES.valueOf()
    ));

    destructors.push(processor.onActionTrace(
        contract, 'setupgrdmix',
        upgradesMixListener(core, contract),
        UpgradesUpdatePriority.SET_MIX.valueOf()
    ));

    destructors.push(processor.onActionTrace(
        contract, 'logclaim',
        logClaimListener(core, contract),
        UpgradesUpdatePriority.LOG_CLAIM.valueOf()
    ));

    return (): any => destructors.map(fn => fn());
}

async function deleteUpgradeSpecs(
    db: ContractDBTransaction,
    upgradeId: number,
    contract: string,
): Promise<void> {
    const deleteString = 'contract = $1 AND upgrade_id = $2';
    const deleteValues = [contract, upgradeId];
    await db.delete('neftyupgrades_upgrade_specs_results', {
        str: deleteString,
        values: deleteValues,
    });
    await db.delete('neftyupgrades_upgrade_specs_requirements', {
        str: deleteString,
        values: deleteValues,
    });
    await db.delete('neftyupgrades_upgrade_specs', {
        str: deleteString,
        values: deleteValues,
    });
}

function getUpgradeDbRows(upgrade: UpgradeTableRow, args: UpgradesArgs, blockNumber: number, blockTimeStamp: string, contract: string): any {
    const ingredients = getUpgradeIngredients(upgrade.ingredients, upgrade.collection_name);
    const {
        ingredientDbRows,
        ingredientAttributesDbRows,
        ingredientTypedAttributesDbRows
    } = getIngredientsDbRows(upgrade.upgrade_id, ingredients, args, blockNumber, blockTimeStamp, contract);

    const displayData = stringToDisplayData(upgrade.display_data);
    return {
        upgradeDbRow: {
            contract,
            collection_name: upgrade.collection_name,
            upgrade_id: upgrade.upgrade_id,
            start_time: upgrade.start_time * 1000,
            end_time: upgrade.end_time * 1000,
            max: upgrade.max,
            use_count: upgrade.use_count,
            name: displayData.name || '',
            display_data: upgrade.display_data,
            ingredients_count: ingredientDbRows.map(({amount}) => amount).reduce((sum,amount) => sum + amount, 0),
            updated_at_block: blockNumber || 0,
            updated_at_time: blockTimeStamp ? eosioTimestampToDate(blockTimeStamp).getTime() : 0,
            created_at_block: blockNumber || 0,
            created_at_time: blockTimeStamp ? eosioTimestampToDate(blockTimeStamp).getTime() : 0,
            security_id: upgrade.security_id || 0,
            is_hidden: upgrade.is_hidden || false,
            category: upgrade.category || '',
        },
        ingredientDbRows,
        ingredientAttributesDbRows,
        ingredientTypedAttributesDbRows,
        ...getUpgradeSpecsDBRows(upgrade.upgrade_id, upgrade.upgrade_specs, args, blockNumber, blockTimeStamp, contract),
    };
}

async function insertUpgradeIngredients(
    db: ContractDBTransaction,
    ingredientDbRows: any[],
    ingredientAttributesDbRows: any[],
    ingredientTypedAttributesDbRows: any[]
): Promise<void> {
    if (ingredientDbRows.length > 0) {
        await db.insert(
            'neftyupgrades_upgrade_ingredients',
            ingredientDbRows,
            ['contract', 'upgrade_id', 'ingredient_index']
        );
    }
    if (ingredientAttributesDbRows.length > 0) {
        await db.insert(
            'neftyupgrades_upgrade_ingredient_attributes',
            ingredientAttributesDbRows,
            ['contract', 'upgrade_id', 'ingredient_index', 'attribute_index']
        );
    }
    if (ingredientTypedAttributesDbRows.length > 0) {
        await db.insert(
            'neftyupgrades_upgrade_ingredient_typed_attributes',
            ingredientTypedAttributesDbRows,
            ['contract', 'upgrade_id', 'ingredient_index', 'typed_attribute_index']
        );
    }
}

async function deleteUpgradeIngredients(
    db: ContractDBTransaction,
    upgradeId: number,
    contract: string,
): Promise<void> {
    const deleteString = 'contract = $1 AND upgrade_id = $2';
    const deleteValues = [contract, upgradeId];
    await db.delete('neftyupgrades_upgrade_ingredient_typed_attributes', {
        str: 'contract = $1 AND upgrade_id = $2',
        values: [contract, upgradeId],
    });
    await db.delete('neftyupgrades_upgrade_ingredient_attributes', {
        str: deleteString,
        values: deleteValues,
    });
    await db.delete('neftyupgrades_upgrade_ingredients', {
        str: deleteString,
        values: deleteValues,
    });
}

function getIngredientsDbRows(upgradeId: number, ingredients: Ingredient[], args: UpgradesArgs, blockNumber: number, blockTimeStamp: string, contract: string): {
    ingredientDbRows: any[], ingredientAttributesDbRows: any[], ingredientTypedAttributesDbRows: any[]
} {
    const ingredientDbRows = [];
    const ingredientAttributesDbRows = [];
    const ingredientTypedAttributesDbRows = [];
    for (const ingredient of ingredients) {
        ingredientDbRows.push({
            contract,
            upgrade_id: upgradeId,
            ingredient_collection_name: ingredient.collection_name,
            template_id: ingredient.template_id,
            schema_name: ingredient.schema_name,
            amount: ingredient.amount,
            effect: encodeDatabaseJson(ingredient.effect),
            ingredient_index: ingredient.index,
            ingredient_type: ingredient.type,
            total_attributes: ingredient.attributes.length || 0,
            updated_at_block: blockNumber || 0,
            updated_at_time: blockTimeStamp ? eosioTimestampToDate(blockTimeStamp).getTime() : 0,
            created_at_block: blockNumber || 0,
            created_at_time: blockTimeStamp ? eosioTimestampToDate(blockTimeStamp).getTime() : 0,
            display_data: ingredient.display_data,
            balance_ingredient_attribute_name: ingredient.balance_ingredient_attribute_name,
            balance_ingredient_cost: ingredient.balance_ingredient_cost,
            ft_ingredient_quantity_price: ingredient.ft_ingredient_quantity_price,
            ft_ingredient_quantity_symbol: ingredient.ft_ingredient_quantity_symbol
        });

        let attributeIndex = 0;
        for (const attribute of ingredient.attributes) {
            ingredientAttributesDbRows.push({
                contract,
                upgrade_id: upgradeId,
                ingredient_collection_name: ingredient.collection_name,
                ingredient_index: ingredient.index,
                attribute_index: attributeIndex,
                attribute_name: attribute.attribute_name,
                comparator: 0,
                allowed_values: encodeDatabaseArray(attribute.allowed_values),
            });
            attributeIndex++;
        }

        let typedAttributeIndex = 0;
        for (const typedAttribute of ingredient.typed_attributes) {
            ingredientTypedAttributesDbRows.push({
                contract,
                upgrade_id: upgradeId,
                ingredient_collection_name: ingredient.collection_name,
                ingredient_index: ingredient.index,
                typed_attribute_index: typedAttributeIndex,

                attribute_name: typedAttribute.attribute_name,
                attribute_type: typedAttribute.attribute_type,
                comparator: typedAttribute.comparator,
                allowed_values_type: typedAttribute.allowed_values[0],
                allowed_values: encodeDatabaseJson(typedAttribute.allowed_values[1])
            });
            typedAttributeIndex++;
        }
    }
    return {ingredientDbRows, ingredientAttributesDbRows, ingredientTypedAttributesDbRows};
}

function getUpgradeSpecsDBRows(upgradeId: number, upgradeSpecs: UpgradeSpec[], args: UpgradesArgs, blockNumber: number, blockTimeStamp: string, contract: string): {
    upgradeSpecsDbRows: any[],
    upgradeRequirementsDbRows: any[],
    upgradeResultsDbRows: any[]
} {
    const upgradeSpecsDbRows = [ ];
    const upgradeRequirementsDbRows = [ ];
    const upgradeResultsDbRows = [ ];
    if(upgradeSpecs) {
        for (let upgradeSpecIndex = 0; upgradeSpecIndex < upgradeSpecs.length; upgradeSpecIndex++){
            const upgradeSpec = upgradeSpecs[upgradeSpecIndex];
            upgradeSpecsDbRows.push({
                contract,
                upgrade_id: upgradeId,
                spec_index: upgradeSpecIndex,
                schema_name: upgradeSpec.schema_name,
                display_data: upgradeSpec.display_data || '',
            });

            // upgrade_requirements
            for (let upgradeRequirementIndex = 0; upgradeRequirementIndex < upgradeSpec.upgrade_requirements.length; upgradeRequirementIndex++){
                const upgradeRequirementType = upgradeSpec.upgrade_requirements[upgradeRequirementIndex][0];
                const upgradeRequirementObject = upgradeSpec.upgrade_requirements[upgradeRequirementIndex][1];

                const newUpgradeRequirementDbRow:any = {
                    contract: contract,
                    upgrade_id: upgradeId,
                    spec_index: upgradeSpecIndex,
                    requirement_index: upgradeRequirementIndex,
                    requirement_type: upgradeRequirementType,
                    requirement_payload: encodeDatabaseJson(upgradeRequirementObject),
                };
                upgradeRequirementsDbRows.push(newUpgradeRequirementDbRow);
            }

            // upgrade_results
            for (let upgradeResultIndex = 0; upgradeResultIndex < upgradeSpec.upgrade_results.length; upgradeResultIndex++){
                const upgradeResultObject = upgradeSpec.upgrade_results[upgradeResultIndex];

                const resultValueType = upgradeResultObject.value[0];
                const resultValueObject = upgradeResultObject.value[1];

                const newUpgradeRequirementDbRow:any = {
                    contract: contract,
                    upgrade_id: upgradeId,
                    spec_index: upgradeSpecIndex,
                    result_index: upgradeResultIndex,

                    attribute_name: upgradeResultObject.attribute_name,
                    attribute_type: upgradeResultObject.attribute_type,
                    operator_type: upgradeResultObject.op.type,
                    value: encodeDatabaseJson(resultValueObject),
                    value_type: resultValueType
                };
                upgradeResultsDbRows.push(newUpgradeRequirementDbRow);
            }
        }
    }

    return {
        upgradeSpecsDbRows,
        upgradeRequirementsDbRows,
        upgradeResultsDbRows
    };
}

function getUpgradeIngredients(ingredients: any[], upgrade_collection: string): Ingredient[] {
    return ingredients.map(([type, payload], index) => {
        const [effectType = '', effectPayload = {}] = payload.effect || [];
        const effect = {
            payload: effectPayload,
            type: effectType
        };
        if (type === UpgradeIngredientType.TEMPLATE_INGREDIENT) {
            return {
                type,
                collection_name: payload.collection_name,
                schema_name: null,
                ft_ingredient_quantity_price: null,
                ft_ingredient_quantity_symbol: null,
                balance_ingredient_attribute_name: null,
                balance_ingredient_cost: null,
                template_id: payload.template_id,
                attributes: [],
                typed_attributes: [],
                display_data: null,
                amount: payload.amount,
                effect,
                index,
            };
        } else if (type === UpgradeIngredientType.SCHEMA_INGREDIENT) {
            return {
                type,
                collection_name: payload.collection_name,
                schema_name: payload.schema_name,
                ft_ingredient_quantity_price: null,
                ft_ingredient_quantity_symbol: null,
                balance_ingredient_attribute_name: null,
                balance_ingredient_cost: null,
                template_id: null,
                attributes: [],
                typed_attributes: [],
                display_data: payload.display_data,
                amount: payload.amount,
                effect,
                index,
            };
        } else if (type === UpgradeIngredientType.COLLECTION_INGREDIENT) {
            return {
                type,
                collection_name: payload.collection_name,
                schema_name: null,
                ft_ingredient_quantity_price: null,
                ft_ingredient_quantity_symbol: null,
                balance_ingredient_attribute_name: null,
                balance_ingredient_cost: null,
                template_id: null,
                attributes: [],
                typed_attributes: [],
                display_data: payload.display_data,
                amount: payload.amount,
                effect,
                index,
            };
        } else if (type === UpgradeIngredientType.ATTRIBUTE_INGREDIENT) {
            return {
                type,
                collection_name: payload.collection_name,
                schema_name: payload.schema_name,
                ft_ingredient_quantity_price: null,
                ft_ingredient_quantity_symbol: null,
                balance_ingredient_attribute_name: null,
                balance_ingredient_cost: null,
                template_id: null,
                attributes: payload.attributes,
                typed_attributes: [],
                display_data: payload.display_data,
                amount: payload.amount,
                effect,
                index,
            };
        } else if (type === UpgradeIngredientType.BALANCE_INGREDIENT) {
            return {
                type,
                collection_name: upgrade_collection,
                schema_name: payload.schema_name,
                ft_ingredient_quantity_price: null,
                ft_ingredient_quantity_symbol: null,
                balance_ingredient_attribute_name: payload.attribute_name || '',
                balance_ingredient_cost: payload.cost || 0,
                template_id: payload.template_id,
                attributes: [],
                typed_attributes: [],
                display_data: payload.display_data,
                amount: 1,
                effect,
                index,
            };
        } else if (type === UpgradeIngredientType.COOLDOWN_INGREDIENT) {
            return {
                type,
                collection_name: upgrade_collection,
                schema_name: payload.schema_name,
                ft_ingredient_quantity_price: null,
                ft_ingredient_quantity_symbol: null,
                balance_ingredient_attribute_name: payload.attribute_name || '',
                balance_ingredient_cost: payload.wait_time || 0,
                template_id: payload.template_id,
                attributes: payload.requirements || [],
                typed_attributes: [],
                display_data: payload.display_data,
                amount: 1,
                effect,
                index,
            };
        } else if (type === UpgradeIngredientType.TYPED_ATTRIBUTE_INGREDIENT) {
            return {
                type,
                collection_name: upgrade_collection,
                schema_name: payload.schema_name,
                ft_ingredient_quantity_price: null,
                ft_ingredient_quantity_symbol: null,
                balance_ingredient_attribute_name: null,
                balance_ingredient_cost: null,
                template_id: null,
                attributes: [],
                typed_attributes: payload.attributes,
                display_data: payload.display_data,
                amount: 1,
                effect,
                index,
            };
        } else if (type === UpgradeIngredientType.FT_INGREDIENT) {
            return {
                type,
                collection_name: upgrade_collection,
                schema_name: null,
                ft_ingredient_quantity_price: preventInt64Overflow(payload.quantity.split(' ')[0].replace('.', '')),
                ft_ingredient_quantity_symbol: payload.quantity.split(' ')[1],
                balance_ingredient_attribute_name: null,
                balance_ingredient_cost: null,
                template_id: null,
                attributes: [],
                typed_attributes: [],
                display_data: payload.display_data,
                amount: 1,
                effect,
                index,
            };
        }
    });
}
