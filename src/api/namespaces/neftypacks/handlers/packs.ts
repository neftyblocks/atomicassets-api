import {RequestValues} from '../../utils';
import {NeftyPacksContext} from '../index';
import QueryBuilder from '../../../builder';
import {filterQueryArgs} from '../../validation';
import {fillPacks} from '../filler';
import {buildGreylistFilter} from '../../atomicassets/utils';
import {formatPack} from '../format';
import {ApiError} from '../../../error';

export async function getPacksAction(params: RequestValues, ctx: NeftyPacksContext): Promise<any> {
    const args = await filterQueryArgs(params, {
        page: {type: 'int', min: 1, default: 1},
        limit: {type: 'int', min: 1, max: 1000, default: 100},
        collection_name: {type: 'string', min: 1},
        render_markdown: {type: 'bool', default: false},
        hide_description: {type: 'bool', default: false},
        display_pending: {type: 'bool', default: false},
        hide_completed: {type: 'bool', default: false},
        contract: {type: 'string'},
        sort: {
            type: 'string',
            allowedValues: [
                'pack_id',
            ],
            default: 'pack_id'
        },
        order: {type: 'string', values: ['asc', 'desc'], default: 'asc'},
        count: {type: 'bool'}
    });


    const query = new QueryBuilder('SELECT * FROM neftypacks_packs packs ');

    if (!args.collection_name) {
        await buildGreylistFilter(params, query, {collectionName: 'packs.collection_name'});
    }

    if (args.contract) {
        query.equal('packs.contract', args.contract);
    }

    if (args.collection_name) {
        query.equalMany('packs.collection_name', args.collection_name.split(','));
    }

    if (args.display_pending === false) {
        query.addCondition('packs.pack_template_id >= 0');
    }

    if (args.hide_completed === true) {
        query.appendToBase('INNER JOIN atomicassets_templates t ON packs.pack_template_id = t.template_id ' +
            'LEFT JOIN atomicassets_asset_counts ac ON ac.template_id = packs.pack_template_id');
        query.addCondition('(packs.use_count = 0 OR t.max_supply = 0 OR COALESCE(ac.burned, 0) < t.max_supply)');
    }

    if (args.count) {
        const countQuery = await ctx.db.query(
            'SELECT COUNT(*) counter FROM (' + query.buildString() + ') x',
            query.buildValues()
        );

        return countQuery.rows[0].counter;
    }

    const sortMapping: {[key: string]: {column: string, nullable: boolean}}  = {
        pack_id: {column: 'packs.pack_id', nullable: false},
    };

    query.append('ORDER BY ' + sortMapping[args.sort].column + ' ' + args.order + ' ' + (sortMapping[args.sort].nullable ? 'NULLS LAST' : ''));
    query.append('LIMIT ' + query.addVariable(args.limit) + ' OFFSET ' + query.addVariable((args.page - 1) * args.limit));

    const result = await ctx.db.query(query.buildString(), query.buildValues());
    return (await fillPacks(ctx.db, ctx.coreArgs.atomicassets_account, result.rows))
        .map((row) => formatPack(row, args.hide_description, args.render_markdown));
}

export async function getPacksCountAction(params: RequestValues, ctx: NeftyPacksContext): Promise<any> {
    return getPacksAction({...params, count: 'true'}, ctx);
}

export async function getPackAction(params: RequestValues, ctx: NeftyPacksContext): Promise<any> {
    const args = await filterQueryArgs(params, {
        render_markdown: {type: 'bool', default: false},
        hide_description: {type: 'bool', default: false},
    });

    const query = await ctx.db.query(
        'SELECT * FROM neftypacks_packs WHERE contract = $1 AND pack_id = $2',
        [ctx.pathParams.contract, ctx.pathParams.pack_id]
    );

    if (query.rowCount === 0) {
        throw new ApiError('Pack not found', 416);
    } else {
        const packs = (await fillPacks(ctx.db, ctx.coreArgs.atomicassets_account, query.rows))
            .map((row) => formatPack(row, args.hide_description, args.render_markdown));
        return packs[0];
    }
}
