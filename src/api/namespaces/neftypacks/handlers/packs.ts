import {RequestValues} from '../../utils';
import {NeftyPacksContext} from '../index';
import QueryBuilder from '../../../builder';
import {filterQueryArgs} from '../../validation';
import {fillPacks} from '../filler';
import {buildGreylistFilter} from '../../atomicassets/utils';
import {formatPack} from '../format';

export async function getPacksAction(params: RequestValues, ctx: NeftyPacksContext): Promise<any> {
    const args = filterQueryArgs(params, {
        page: {type: 'int', min: 1, default: 1},
        limit: {type: 'int', min: 1, max: 100, default: 100},
        collection_name: {type: 'string', min: 1},
        render_markdown: {type: 'bool', default: false},
        hide_description: {type: 'bool', default: false},
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


    const query = new QueryBuilder('SELECT packs.pack_id FROM neftypacks_packs packs');

    if (!args.collection_name) {
        buildGreylistFilter(params, query, {collectionName: 'packs.collection_name'});
    }

    if (args.contract) {
        query.equal('packs.contract', args.contract);
    }

    if (args.collection_name) {
        query.equalMany('packs.collection_name', args.collection_name.split(','));
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
