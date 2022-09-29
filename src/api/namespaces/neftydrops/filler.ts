import {DB} from '../../server';
import {FillerHook} from '../atomicassets/filler';
import {formatAsset} from './format';

export class AssetsFiller {
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

export async function fillDrops(db: DB, assetContract: string, drops: any[]): Promise<any[]> {
    const templateIds: string[] = [];

    for (const drop of drops) {
        const dropTemplateIds: string[] = drop.assets.filter((asset: any) => asset.template_id > -1).map((asset: any) => asset.template_id.toString());
        templateIds.push(...dropTemplateIds);
    }

    const filler = new AssetsFiller(db, assetContract, templateIds, formatAsset, 'atomicassets_templates_master');

    return await Promise.all(drops.map(async (drop) => {
        drop.assets = await Promise.all(drop.assets.map((asset: any) => {
            const result: any = {};
            if (asset.template_id > -1) {
                result.template = filler.fillTemplate(asset.template_id);
            } else if (asset.bank_name) {
                result.bank_name = asset.bank_name;
            }
            result.tokens_to_back = asset.tokens_to_back;
        }));
        drop.templates = drop.assets.filter((asset: any) => !!asset.template).map((asset: any) => asset.template);
        return drop;
    }));
}
