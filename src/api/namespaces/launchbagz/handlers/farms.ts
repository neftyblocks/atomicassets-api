import {buildBoundaryFilter, RequestValues} from '../../utils';
import {LaunchesContext} from '../index';
import QueryBuilder from '../../../builder';
import {filterQueryArgs} from '../../validation';
import {ApiError} from '../../../error';

export async function getFarms(params: RequestValues, ctx: LaunchesContext): Promise<any> {
    const args = await filterQueryArgs(params, {
        page: {type: 'int', min: 1, default: 1},
        limit: {type: 'int', min: 1, max: 1000, default: 100},
        count: {type: 'bool'},
        sort: {type: 'string', values: ['created_at_time', 'updated_at_time'], default: 'created_at_time'},
        order: {type: 'string', values: ['asc', 'desc'], default: 'desc'},
        staked_token: {type: 'string', default: ''},
        reward_token: {type: 'string', default: ''},
        creator: {type: 'string', default: ''},
        original_creator: {type: 'string', default: false},
    });

    const query = new QueryBuilder('SELECT * FROM launchbagz_farms f ');

    if (args.reward_token) {
        const codes: string[] = [];
        const contracts: string[] = [];
        args.reward_token.trim().split(',').forEach((token: string) => {
            const [symbolCode, contract] = token.trim().split('@');
            codes.push(symbolCode);
            contracts.push(contract);
        });
        query.addCondition(
            `EXISTS (
                SELECT * FROM launchbagz_farm_rewards fr 
                INNER JOIN (SELECT unnest(${query.addVariable(contracts)}::text[]) contract, unnest(${query.addVariable(codes)}::text[]) code) ids 
                ON (fr.reward_token_contract = ids.contract AND fr.reward_token_code = ids.code)
                WHERE fr.farm_name = f.farm_name AND fr.contract = f.contract
            )`
        );
    }

    if (args.staked_token) {
        const [symbolCode, contract] = args.staked_token.trim().split('@');
        query.addCondition(`f.staking_token_code = ${query.addVariable(symbolCode)} AND f.staking_token_contract = ${query.addVariable(contract)}`);
    }

    if (args.creator) {
        query.addCondition(`f.creator = ${query.addVariable(args.creator)}`);
    }

    if (args.original_creator) {
        query.addCondition(`f.original_creator = ${query.addVariable(args.original_creator)}`);
    }

    let dateColumn = 'f.created_at_time';
    if (args.sort === 'updated_at_time') {
        dateColumn = 'f.updated_at_time';
    }
    await buildBoundaryFilter(
        params, query, 'f.farm_name', 'string',
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
        created_at_time: {column: 'f.created_at_time', nullable: false},
        updated_at_time: {column: 'f.updated_at_time', nullable: false},
    };

    query.append(`ORDER BY ${sortMapping[args.sort].column} ${args.order} ${sortMapping[args.sort].nullable ? 'NULLS LAST' : ''}`);
    query.append('LIMIT ' + query.addVariable(args.limit) + ' OFFSET ' + query.addVariable((args.page - 1) * args.limit));

    const farmsQuery = await ctx.db.query(query.buildString(), query.buildValues());
    const result = await ctx.db.query(
        'SELECT * FROM launchbagz_farms_master WHERE contract = $1 AND farm_name = ANY ($2)',
        [ctx.coreArgs.farms_account, farmsQuery.rows.map(row => row.farm_name)]
    );

    const farmLookup: {[key: string]: any} = {};
    result.rows.reduce((prev, current) => {
        prev[String(current.farm_name)] = current;
        return prev;
    }, farmLookup);
    return farmsQuery.rows.map((row) => farmLookup[String(row.farm_name)]);
}

export async function getFarmsCount(params: RequestValues, ctx: LaunchesContext): Promise<any> {
    return getFarms({...params, count: 'true'}, ctx);
}

export async function getFarmDetail(params: RequestValues, ctx: LaunchesContext): Promise<any> {
    const query = await ctx.db.query(
        'SELECT * FROM launchbagz_farms_master WHERE contract = $1 AND farm_name = $2',
        [ctx.coreArgs.farms_account, ctx.pathParams.farm_name]
    );

    if (query.rowCount === 0) {
        throw new ApiError('Farm not found', 416);
    } else {
        return query.rows[0];
    }
}
