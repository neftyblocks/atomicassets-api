import DataProcessor from '../../../processor';
import { ContractDBTransaction } from '../../../database';
import { EosioContractRow } from '../../../../types/eosio';
import { ShipBlock } from '../../../../types/ship';
import { eosioTimestampToDate } from '../../../../utils/eosio';
import CollectionsListHandler, {CollectionsListArgs, HelpersUpdatePriority} from '../index';
import ConnectionManager from '../../../../connections/manager';
import {AccListTableRow, ColThemeData, FeaturesTableRow} from '../types/tables';
import {bulkInsert} from '../../../utils';
import logger from '../../../../utils/winston';

const atomicCollectionListRegex = /^col\..*$/g;
const neftyCollectionListRegex = /^(whitelist|verified|blacklist|nsfw|scam|exceptions|ai)$/g;
const zneftyCollectionListRegex = /^(z\.whitelist|z\.verified|z\.blacklist|z\.nsfw|z\.scam)$/g;

export async function initCollections(args: CollectionsListArgs, connection: ConnectionManager): Promise<void> {
    const featuresQuery = await connection.database.query(
        'SELECT * FROM helpers_collection_list WHERE assets_contract = $1',
        [args.atomicassets_account]
    );

    if (featuresQuery.rows.length === 0) {

        let databaseRows: any[] = [];

        const featuresTable = await connection.chain.rpc.get_table_rows({
            json: true, code: args.features_account,
            scope: args.features_account,
            table: 'features', limit: 1000,
        });

        databaseRows = databaseRows.concat(featuresTable.rows.filter(list => list.list.match(neftyCollectionListRegex)).flatMap((row: FeaturesTableRow) => {
            logger.info(`Adding collection list ${row.list} to database for contract ${args.features_account}`);
            return [...new Set(row.collections)].map(collection => ({
                assets_contract: args.atomicassets_account,
                contract: args.features_account,
                list: convertCollectionListName(args.features_account, row.list, args),
                collection_name: collection,
                updated_at_block: 0,
                updated_at_time: new Date().getTime()
            }));
        }));

        databaseRows = databaseRows.concat(featuresTable.rows.filter(list => list.list.match(zneftyCollectionListRegex)).flatMap((row: FeaturesTableRow) => {
            logger.info(`Adding collection list ${row.list} to database for contract atomic`);
            return [...new Set(row.collections)].map(collection => ({
                assets_contract: args.atomicassets_account,
                contract: 'atomic',
                list: convertCollectionListName(args.features_account, row.list, args),
                collection_name: collection,
                updated_at_block: 0,
                updated_at_time: new Date().getTime()
            }));
        }));

        if (args.hub_tools_account) {
            const atomicAccountsTable = await connection.chain.rpc.get_table_rows({
                json: true, code: args.hub_tools_account,
                scope: args.hub_tools_account,
                table: 'acclists', limit: 1000,
            });

            databaseRows = databaseRows.concat(...atomicAccountsTable.rows.filter(list => list.list_name.match(atomicCollectionListRegex)).flatMap((row: AccListTableRow) => {
                return [...new Set(row.list)].filter(collection => collection.length <= 13).map(collection => ({
                    assets_contract: args.atomicassets_account,
                    contract: args.hub_tools_account,
                    list: convertCollectionListName(args.hub_tools_account, row.list_name, args),
                    collection_name: collection,
                    updated_at_block: 0,
                    updated_at_time: new Date().getTime()
                }));
            }));
        }

        if (databaseRows.length > 0) {
            await bulkInsert(connection.database, 'helpers_collection_list', databaseRows);
        }
    }
}

const getDifference = <T>(a: T[], b: T[]): T[] => {
    return [...new Set<T>(a)].filter((element) => {
        return !b.includes(element);
    });
};

export function collectionsProcessor(core: CollectionsListHandler, processor: DataProcessor): () => any {
    const destructors: Array<() => any> = [];
    const neftyContract = core.args.features_account;
    const atomicContract = core.args.hub_tools_account;

    destructors.push(processor.onContractRow(
        neftyContract, 'features',
        async (db: ContractDBTransaction, block: ShipBlock, delta: EosioContractRow<FeaturesTableRow>): Promise<void> => {
            const matchesNeftyList = delta.value.list.match(neftyCollectionListRegex);
            const matchesAtomicList = delta.value.list.match(zneftyCollectionListRegex);
            const contractName = matchesNeftyList ? neftyContract : matchesAtomicList ? 'atomic' : null;
            if (delta.scope === neftyContract && contractName) {
                const listName = convertCollectionListName(neftyContract, delta.value.list, core.args);

                if (!delta.present) {
                    await db.delete('helpers_collection_list', {
                        str: 'assets_contract = $1 AND contract = $2 AND list = $3',
                        values: [core.args.atomicassets_account, contractName, listName]
                    });
                } else {
                    const collectionsQuery = await db.query('SELECT collection_name FROM helpers_collection_list WHERE assets_contract = $1 AND contract = $2 AND list = $3',
                        [core.args.atomicassets_account, contractName, listName]
                    );

                    const collections = collectionsQuery.rows.map(({ collection_name }) => collection_name);
                    const addedCollections = getDifference(delta.value.collections, collections);
                    const deletedCollections = getDifference(collections, delta.value.collections);

                    if (deletedCollections.length > 0) {
                        await db.delete('helpers_collection_list', {
                            str: 'assets_contract = $1 AND contract = $2 AND list = $3 AND collection_name = ANY($4)',
                            values: [core.args.atomicassets_account, contractName, listName, deletedCollections]
                        });
                    }

                    if (addedCollections.length > 0) {
                        await db.insert('helpers_collection_list', addedCollections.map(collection => {
                            return {
                                assets_contract: core.args.atomicassets_account,
                                contract: contractName,
                                list: listName,
                                collection_name: collection,
                                updated_at_block: block.block_num,
                                updated_at_time: eosioTimestampToDate(block.timestamp).getTime(),
                            };
                        }), ['assets_contract', 'collection_name', 'contract', 'list']);
                    }
                }
            }
        }, HelpersUpdatePriority.TABLE_FEATURES.valueOf()
    ));

    destructors.push(processor.onContractRow(
        neftyContract, 'colthemedata',
        async (db: ContractDBTransaction, block: ShipBlock, delta: EosioContractRow<ColThemeData>): Promise<void> => {

            if (!delta.present) {
                await db.delete('helpers_collection_tags', {
                    str: 'collection_name = $1',
                    values: [delta.value.collection]
                });
            } else if (delta.value.tags) {
                const tagsQuery = await db.query('SELECT tag FROM helpers_collection_tags WHERE collection_name = $1',
                    [delta.value.collection]
                );

                const currentTags = tagsQuery.rows.map(({ tag }) => tag);
                const addedTags = getDifference(delta.value.tags, currentTags);
                const deletedTags = getDifference(currentTags, delta.value.tags);

                if (deletedTags.length > 0) {
                    await db.delete('helpers_collection_tags', {
                        str: 'collection_name = $1 AND tag = ANY($2)',
                        values: [delta.value.collection, deletedTags]
                    });
                }

                if (addedTags.length > 0) {
                    await db.insert('helpers_collection_tags', addedTags.map(tag => {
                        return {
                            collection_name: delta.value.collection,
                            tag,
                            updated_at_block: block.block_num,
                            updated_at_time: eosioTimestampToDate(block.timestamp).getTime(),
                        };
                    }), ['collection_name', 'tag']);
                }
            }

        }, HelpersUpdatePriority.TABLE_COLLECTIONS.valueOf()
    ));

    if (atomicContract) {
        destructors.push(processor.onContractRow(
            atomicContract, 'acclists',
            async (db: ContractDBTransaction, block: ShipBlock, delta: EosioContractRow<AccListTableRow>): Promise<void> => {
                if (delta.scope === atomicContract && delta.value.list_name.match(atomicCollectionListRegex)) {
                    const listName = convertCollectionListName(atomicContract, delta.value.list_name, core.args);

                    if (!delta.present) {
                        await db.delete('helpers_collection_list', {
                            str: 'assets_contract = $1 AND contract = $2 AND list = $3',
                            values: [core.args.atomicassets_account, atomicContract, listName]
                        });
                    } else {
                        const collectionsQuery = await db.query('SELECT collection_name FROM helpers_collection_list WHERE assets_contract = $1 AND contract = $2 AND list = $3',
                            [core.args.atomicassets_account, atomicContract, listName]
                        );

                        const collections = collectionsQuery.rows.map(({ collection_name }) => collection_name);
                        const addedCollections = getDifference(delta.value.list, collections);
                        const deletedCollections = getDifference(collections, delta.value.list);

                        if (deletedCollections.length > 0) {
                            await db.delete('helpers_collection_list', {
                                str: 'assets_contract = $1 AND contract = $2 AND list = $3 AND collection_name = ANY($4)',
                                values: [core.args.atomicassets_account, atomicContract, listName, deletedCollections]
                            });
                        }

                        if (addedCollections.length > 0) {
                            await db.insert('helpers_collection_list', addedCollections.map(collection => {
                                return {
                                    assets_contract: core.args.atomicassets_account,
                                    contract: atomicContract,
                                    list: listName,
                                    collection_name: collection,
                                    updated_at_block: block.block_num,
                                    updated_at_time: eosioTimestampToDate(block.timestamp).getTime(),
                                };
                            }), ['assets_contract', 'collection_name', 'contract', 'list']);
                        }
                    }
                }
            }, HelpersUpdatePriority.TABLE_FEATURES.valueOf()
        ));
    }

    return (): any => destructors.map(fn => fn());
}

function convertCollectionListName(contract: string, list_name: string, args: CollectionsListArgs): string {
    let list = '';
    if (contract === args.hub_tools_account) {
        if (list_name === 'col.wlist') {
            list = 'whitelist';
        } else if (list_name === 'col.blist') {
            list = 'blacklist';
        } else if (list_name === 'col.verify') {
            list = 'verified';
        } else if (list_name === 'col.nsfw') {
            list = 'nsfw';
        } else if (list_name === 'col.scam') {
            list = 'scam';
        }
    } else if (contract === args.features_account) {
        if (list_name === 'whitelist') {
            list = 'whitelist';
        } else if (list_name === 'blacklist') {
            list = 'blacklist';
        } else if (list_name === 'verified') {
            list = 'verified';
        } else if (list_name === 'nsfw') {
            list = 'nsfw';
        } else if (list_name === 'scam') {
            list = 'scam';
        } else if (list_name === 'exceptions') {
            list = 'exceptions';
        } else  if (list_name === 'z.whitelist') {
            list = 'whitelist';
        } else if (list_name === 'z.blacklist') {
            list = 'blacklist';
        } else if (list_name === 'z.verified') {
            list = 'verified';
        } else if (list_name === 'z.nsfw') {
            list = 'nsfw';
        } else if (list_name === 'z.scam') {
            list = 'scam';
        } else if (list_name === 'ai') {
            list = 'ai';
        }
    }
    return list;
}
