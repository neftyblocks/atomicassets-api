import {buildBoundaryFilter, RequestValues} from '../../utils';
import {LaunchesContext} from '../index';
import QueryBuilder from '../../../builder';
import {filterQueryArgs} from '../../validation';

export async function getVestings(params: RequestValues, ctx: LaunchesContext): Promise<any> {
    const args = await filterQueryArgs(params, {
        page: {type: 'int', min: 1, default: 1},
        limit: {type: 'int', min: 1, max: 1000, default: 100},
        count: {type: 'bool'},
        sort: {type: 'string', values: [
            'start_time', 'vesting_id', 'created_at_time', 'updated_at_time', 'total_allocation'
        ], default: 'vesting_id'},
        order: {type: 'string', values: ['asc', 'desc'], default: 'desc'},
        token: {type: 'string', default: ''},
        owner: {type: 'string', default: ''},
        recipient: {type: 'string', default: ''},
        is_active: { type: 'bool'},
    });

    const query = new QueryBuilder(`SELECT * FROM launchbagz_vestings v `);
    if (args.token) {
        const codes: string[] = [];
        const contracts: string[] = [];
        args.token.trim().split(',').forEach((token: string) => {
            const [symbolCode, contract] = token.trim().split('@');
            codes.push(symbolCode);
            contracts.push(contract);
        });
        query.appendToBase(`
            INNER JOIN (SELECT unnest(${query.addVariable(contracts)}::text[]) contract, unnest(${query.addVariable(codes)}::text[]) code) ids 
            ON (v.token_contract = ids.contract AND v.token_code = ids.code)
        `);
    }

    if (args.owner) {
        query.addCondition(`v.owner = ${query.addVariable(args.owner)}`);
    }

    if (args.recipient) {
        query.addCondition(`v.recipient = ${query.addVariable(args.recipient)}`);
    }

    if (typeof args.is_active === 'boolean') {
        if (args.is_active) {
            query.addCondition('v.total_claimed != v.total_allocation');
        } else {
            query.addCondition('v.total_claimed = v.total_allocation');
        }
    }

    let dateColumn = 'v.created_at_time';
    if (args.sort === 'updated_at_time') {
        dateColumn = 'v.updated_at_time';
    } else if (args.sort === 'start_time') {
        dateColumn = 'v.start_time';
    }
    await buildBoundaryFilter(
        params, query, 'v.vesting_id', 'string',
        dateColumn
    );

    if (args.count) {
        const countQuery = await ctx.db.query(
            'SELECT COUNT(*) counter FROM (' + query.buildString() + ') x',
            query.buildValues()
        );

        return countQuery.rows[0].counter;
    }

    const sortMapping: {[key: string]: {column: string, nullable: boolean}}  = {
        created_at_time: {column: 'v.created_at_time', nullable: false},
        updated_at_time: {column: 'v.updated_at_time', nullable: false},
        start_time: {column: 'v.start_time', nullable: false},
        vesting_id: {column: 'v.vesting_id', nullable: false},
        total_allocation: {column: 'v.total_allocation', nullable: false},
    };

    query.append(`ORDER BY ${sortMapping[args.sort].column} ${args.order} ${sortMapping[args.sort].nullable ? 'NULLS LAST' : ''}`);
    query.append('LIMIT ' + query.addVariable(args.limit) + ' OFFSET ' + query.addVariable((args.page - 1) * args.limit));

    const vestingsQuery = await ctx.db.query(query.buildString(), query.buildValues());
    return vestingsQuery.rows;
}

export async function getVestingsCount(params: RequestValues, ctx: LaunchesContext): Promise<any> {
    return getVestings({...params, count: 'true'}, ctx);
}
