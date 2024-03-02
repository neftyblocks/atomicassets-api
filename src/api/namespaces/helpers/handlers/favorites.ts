import { RequestValues} from '../../utils';
import {NeftyMarketContext} from '../index';
import QueryBuilder from '../../../builder';
import {filterQueryArgs} from '../../validation';
import {NeftyBlendsContext} from '../../neftyblends';

export async function getCollectionFollowers(params: RequestValues, ctx: NeftyMarketContext): Promise<any> {
    const args = await filterQueryArgs(params, {
        page: {type: 'int', min: 1, default: 1},
        limit: {type: 'int', min: 1, max: 1000, default: 100},
        count: {type: 'bool'},
        sort: {type: 'string', values: ['user_name'], default: 'user_name'},
        order: {type: 'string', values: ['asc', 'desc'], default: 'asc'},
    });

    if (args.count) {
        const result = await ctx.db.query('SELECT COUNT(*) FROM helpers_favorite_collections WHERE collection_name = $1', [ctx.pathParams.collection_name]);
        return result.rows[0].count;
    }

    const query = new QueryBuilder('SELECT owner as user_name, updated_at_time FROM helpers_favorite_collections');
    query.equal('collection_name', ctx.pathParams.collection_name);

    const sortMapping: {[key: string]: {column: string, nullable: boolean}}  = {
        user_name: {column: 'owner', nullable: false},
    };

    query.append(`ORDER BY ${sortMapping[args.sort].column} ${args.order} ${sortMapping[args.sort].nullable ? 'NULLS LAST' : ''}`);
    query.append('LIMIT ' + query.addVariable(args.limit) + ' OFFSET ' + query.addVariable((args.page - 1) * args.limit));

    const result = await ctx.db.query(query.buildString(), query.buildValues());
    return result.rows;
}

export async function getCollectionFollowersCount(params: RequestValues, ctx: NeftyBlendsContext): Promise<any> {
    return getCollectionFollowers({...params, count: 'true'}, ctx);
}
