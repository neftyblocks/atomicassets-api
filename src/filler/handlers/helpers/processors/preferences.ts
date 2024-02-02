import DataProcessor from '../../../processor';
import { ContractDBTransaction } from '../../../database';
import { EosioContractRow } from '../../../../types/eosio';
import { ShipBlock } from '../../../../types/ship';
import { eosioTimestampToDate } from '../../../../utils/eosio';
import CollectionsListHandler, {CollectionsListArgs, HelpersUpdatePriority} from '../index';
import ConnectionManager from '../../../../connections/manager';
import {PreferencesData} from '../types/tables';
import {bulkInsert, getAllScopesFromTable, getDifference} from '../../../utils';
import logger from '../../../../utils/winston';

const FAVORITES_LIST = 'fav.cols';
const CONTACTS = 'contacts';

export async function initPreferences(args: CollectionsListArgs, connection: ConnectionManager): Promise<void> {
    const favoritesQuery = await connection.database.query(
        'SELECT COUNT(*) FROM helpers_favorite_collections',
        []
    );

    const contactsQuery = await connection.database.query(
        'SELECT COUNT(*) FROM helpers_contacts',
        []
    );

    const updateFavorites = +favoritesQuery.rows[0].count === 0;
    const updateContacts = +contactsQuery.rows[0].count === 0;

    if (updateFavorites || updateContacts) {
        const favoritesDbRows: any[] = [];
        const contactsDbRows: any[] = [];

        const users = await getAllScopesFromTable(connection.chain.rpc, {
            code: args.features_account,
            table: 'preferences',
        }, 1000);

        for (const user of users) {
            logger.info(`Processing preferences for user ${user.scope}`);
            if (updateFavorites) {
                const favorites = (await connection.chain.rpc.get_table_rows({
                    json: true, code: args.features_account,
                    scope: user.scope,
                    lower_bound: FAVORITES_LIST,
                    upper_bound: FAVORITES_LIST,
                    table: 'preferences', limit: 1,
                })).rows[0]?.values || [];

                favorites.forEach((collection: string) => {
                    favoritesDbRows.push({
                        owner: user.scope,
                        collection_name: collection,
                        updated_at_block: 0,
                        updated_at_time: 0,
                    });
                });
            }

            if (updateContacts) {
                const contacts = (await connection.chain.rpc.get_table_rows({
                    json: true, code: args.features_account,
                    scope: user.scope,
                    lower_bound: CONTACTS,
                    upper_bound: CONTACTS,
                    table: 'preferences', limit: 1,
                })).rows[0]?.values || [];

                contacts.forEach((contact: string) => {
                    contactsDbRows.push({
                        owner: user.scope,
                        contact: contact,
                        updated_at_block: 0,
                        updated_at_time: 0,
                    });
                });
            }
        }

        if (favoritesDbRows.length > 0) {
            await bulkInsert(connection.database, 'helpers_favorite_collections', favoritesDbRows);
        }

        if (contactsDbRows.length > 0) {
            await bulkInsert(connection.database, 'helpers_contacts', contactsDbRows);
        }
    }
}

export function preferencesProcessor(core: CollectionsListHandler, processor: DataProcessor): () => any {
    const destructors: Array<() => any> = [];
    const neftyContract = core.args.features_account;

    destructors.push(processor.onContractRow(
        neftyContract, 'preferences',
        async (db: ContractDBTransaction, block: ShipBlock, delta: EosioContractRow<PreferencesData>): Promise<void> => {

            if (delta.value.value === FAVORITES_LIST) {
                if (delta.present) {

                    const favoritesQuery = await db.query('SELECT collection_name FROM helpers_favorite_collections WHERE owner = $1',
                        [delta.scope]
                    );

                    const collections = favoritesQuery.rows.map(({ collection_name }) => collection_name);
                    const addedCollections = getDifference(delta.value.values, collections);
                    const deletedCollections = getDifference(collections, delta.value.values);

                    if (deletedCollections.length > 0) {
                        await db.delete('helpers_favorite_collections', {
                            str: 'owner = $1 AND collection_name = ANY($2)',
                            values: [delta.scope, deletedCollections]
                        });
                    }

                    if (addedCollections.length > 0) {
                        await db.insert('helpers_favorite_collections', addedCollections.map(collection_name => {
                            return {
                                owner: delta.scope,
                                collection_name,
                                updated_at_block: block.block_num,
                                updated_at_time: eosioTimestampToDate(block.timestamp).getTime(),
                            };
                        }), ['owner', 'collection_name']);
                    }
                } else {
                    await db.delete('helpers_favorite_collections', {
                        str: 'owner = $1',
                        values: [delta.scope]
                    });
                }
            } else if (delta.value.value === CONTACTS) {
                if (delta.present) {
                    const contactsQuery = await db.query('SELECT contact FROM helpers_contacts WHERE owner = $1',
                        [delta.scope]
                    );

                    const contacts = contactsQuery.rows.map(({ contact }) => contact);
                    const addedContacts = getDifference(delta.value.values, contacts);
                    const deletedContacts = getDifference(contacts, delta.value.values);

                    if (deletedContacts.length > 0) {
                        await db.delete('helpers_contacts', {
                            str: 'owner = $1 AND contact = ANY($2)',
                            values: [delta.scope, deletedContacts]
                        });
                    }

                    if (addedContacts.length > 0) {
                        await db.insert('helpers_contacts', addedContacts.map(contact => {
                            return {
                                owner: delta.scope,
                                contact,
                                updated_at_block: block.block_num,
                                updated_at_time: eosioTimestampToDate(block.timestamp).getTime(),
                            };
                        }), ['owner', 'contact']);
                    }
                } else {
                    await db.delete('helpers_contacts', {
                        str: 'owner = $1',
                        values: [delta.scope]
                    });
                }
            }
        }, HelpersUpdatePriority.TABLE_PREFERENCES.valueOf()
    ));

    return (): any => destructors.map(fn => fn());
}
