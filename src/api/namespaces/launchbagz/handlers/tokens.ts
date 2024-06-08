import {RequestValues} from '../../utils';
import {LaunchesContext} from '../index';
import QueryBuilder from '../../../builder';
import {filterQueryArgs} from '../../validation';

export async function getTokensAction(params: RequestValues, ctx: LaunchesContext): Promise<any> {
    const args = await filterQueryArgs(params, {
        page: {type: 'int', min: 1, default: 1},
        limit: {type: 'int', min: 1, max: 1000, default: 100},
        sort: {type: 'string', allowedValues: ['token_contract', 'token_code', 'created_at_time', 'updated_at_time'], default: 'token_code'},
        order: {type: 'string', allowedValues: ['asc', 'desc'], default: 'asc'},
        token_contract: {type: 'string', default: ''},
    });

    const query = new QueryBuilder(`
                SELECT contract, token_contract, token_code, image, created_at_time, updated_at_time, created_at_block, updated_at_block
                FROM launchbagz_tokens as t
            `);

    query.equal('t.contract', ctx.coreArgs.registry_account);

    if (args.token_contract) {
        query.equalMany('t.token_contract', args.token_contract.split(',').map((t: string) => t.trim()));
    }

    const sortMapping: {[key: string]: {column: string, nullable: boolean}}  = {
        token_contract: {column: 'token_contract', nullable: false},
        token_code: {column: 'token_code', nullable: false},
        created_at_time: {column: 'created_at_time', nullable: false},
        updated_at_time: {column: 'updated_at_time', nullable: false},
    };

    query.append(`ORDER BY ${sortMapping[args.sort].column} ${args.order} ${sortMapping[args.sort].nullable ? 'NULLS LAST' : ''}`);
    query.append('LIMIT ' + query.addVariable(args.limit) + ' OFFSET ' + query.addVariable((args.page - 1) * args.limit));

    const result = await ctx.db.query(query.buildString(), query.buildValues());
    return result.rows;
}
