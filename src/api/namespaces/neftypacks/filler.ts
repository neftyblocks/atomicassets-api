import { FillerHook} from '../atomicassets/filler';
import {formatCollection, formatTemplate} from '../atomicassets/format';
import { DB } from '../../server';

export class TemplateFiller {
    private templates: Promise<{[key: string]: any}> | null;

    constructor(
        readonly db: DB,
        readonly contract: string,
        readonly templateIds: string[],
        readonly formatter: (_: any) => any,
        readonly view: string,
        readonly hook?: FillerHook
    ) {
        this.templates = null;
    }

    async fillTemplate(templateId: string): Promise<any[]> {
        this.query();

        const data = await this.templates;

        return data[String(templateId)] || String(templateId);
    }

    query(): void {
        if (this.templates !== null) {
            return;
        }

        this.templates = new Promise(async (resolve, reject) => {
            if (this.templateIds.length === 0) {
                return resolve({});
            }

            try {
                const query = await this.db.query(
                    'SELECT * FROM ' + this.view + ' WHERE contract = $1 AND template_id = ANY ($2)',
                    [this.contract, this.templateIds]
                );

                const rows = this.hook ? await this.hook(this.db, this.contract, query.rows) : query.rows;
                const result: {[key: string]: any} = {};

                for (const row of rows) {
                    result[String(row.template_id)] = this.formatter(row);
                }

                return resolve(result);
            } catch (e) {
                return reject(e);
            }
        });
    }
}

export class TemplateTransfersFiller {
    private templates: Promise<{[key: string]: any}> | null;

    constructor(
        readonly db: DB,
        readonly assetsContract: string,
        readonly packsContract: string,
        readonly templateIds: string[],
    ) {
        this.templates = null;
    }

    async fillCount(templateId: string): Promise<number> {
        this.query();

        const data = await this.templates;

        return data[String(templateId)] || String(templateId);
    }

    query(): void {
        if (this.templates !== null) {
            return;
        }

        this.templates = new Promise(async (resolve, reject) => {
            if (this.templateIds.length === 0) {
                return resolve({});
            }

            try {
                const query = await this.db.query(
                    'SELECT a.template_id, COUNT(*) count FROM atomicassets_transfers t ' +
                    'INNER JOIN atomicassets_transfers_assets ta ON t.transfer_id = ta.transfer_id AND t.contract = ta.contract ' +
                    'INNER JOIN atomicassets_assets a ON ta.asset_id = a.asset_id AND ta.contract = a.contract ' +
                    'WHERE a.contract = $1 AND a.template_id = ANY($2) AND recipient = $3 ' +
                    'GROUP BY a.template_id',
                    [this.assetsContract, this.templateIds, this.packsContract]
                );

                const rows = query.rows;
                const result: {[key: string]: any} = {};

                for (const row of rows) {
                    result[String(row.template_id)] = row.count;
                }

                return resolve(result);
            } catch (e) {
                return reject(e);
            }
        });
    }
}

export class CollectionFiller {
    private collections: Promise<{[key: string]: any}> | null;

    constructor(
        readonly db: DB,
        readonly contract: string,
        readonly collectionNames: any[],
        readonly formatter: (_: any) => any,
        readonly view: string,
        readonly hook?: FillerHook
    ) {
        this.collections = null;
    }

    async fill(collectionName: string): Promise<any> {
        this.query();

        const data = await this.collections;
        return data[collectionName] || collectionName;
    }

    query(): void {
        if (this.collections !== null) {
            return;
        }

        this.collections = new Promise(async (resolve, reject) => {
            if (this.collectionNames.length === 0) {
                return resolve({});
            }

            try {
                const query = await this.db.query(
                    'SELECT * FROM ' + this.view + ' WHERE contract = $1 AND collection_name = ANY ($2)',
                    [this.contract, this.collectionNames]
                );

                const rows = this.hook ? await this.hook(this.db, this.contract, query.rows) : query.rows;
                const result: {[key: string]: any} = {};

                for (const row of rows) {
                    result[String(row.collection_name)] = this.formatter(row);
                }

                return resolve(result);
            } catch (e) {
                return reject(e);
            }
        });
    }
}
export async function fillPacks(db: DB, assetContract: string, packs: any[]): Promise<any[]> {
    const atomicPacksContract = 'atomicpacksx';
    const templateIds = packs.map((pack) => pack.pack_template_id.toString()).filter((templateId) => templateId !== '-1');
    const templateTransfersToCount = packs.filter((pack) => pack.contract === atomicPacksContract && +pack.pack_template_id !== -1).map((pack) => pack.pack_template_id);
    const collectionNames = [...new Set(packs.map((pack) => pack.collection_name))];

    const templateFiller = new TemplateFiller(db, assetContract, templateIds, formatTemplate, 'atomicassets_templates_master');
    const collectionFiller = new CollectionFiller(db, assetContract, collectionNames, formatCollection, 'atomicassets_collections_master');
    const transfersCountFiller = new TemplateTransfersFiller(db, assetContract, atomicPacksContract, templateTransfersToCount);

    return await Promise.all(packs.map(async (pack) => {
        pack.pack_template = pack.pack_template_id.toString() !== '-1' ? await templateFiller.fillTemplate(pack.pack_template_id.toString()) : null;
        pack.collection = await collectionFiller.fill(pack.collection_name);
        if (pack.contract === atomicPacksContract && +pack.pack_template_id !== -1) {
            pack.use_count = await transfersCountFiller.fillCount(pack.pack_template_id.toString());
        }
        return pack;
    }));
}
