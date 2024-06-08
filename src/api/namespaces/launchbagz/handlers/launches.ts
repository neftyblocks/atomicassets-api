import {buildBoundaryFilter, RequestValues} from '../../utils';
import {LaunchesContext} from '../index';
import QueryBuilder from '../../../builder';
import {filterQueryArgs} from '../../validation';
import {fillBlends} from '../../neftyblends/filler';
import {ApiError} from '../../../error';

export async function getLaunches(params: RequestValues, ctx: LaunchesContext): Promise<any> {
    const args = await filterQueryArgs(params, {
        page: {type: 'int', min: 1, default: 1},
        limit: {type: 'int', min: 1, max: 1000, default: 100},
        count: {type: 'bool'},
        sort: {type: 'string', values: ['token_contract', 'token_code', 'created_at_time', 'updated_at_time', 'launch_date'], default: 'created_at_time'},
        order: {type: 'string', values: ['asc', 'desc'], default: 'desc'},
        token_contract: {type: 'string', default: ''},
        token_code: {type: 'string', default: ''},
        authorized_account: {type: 'string', default: ''},
        is_hidden: {type: 'bool'},
    });

    const query = new QueryBuilder('SELECT l.launch_id, l.is_hidden hide, l.token_contract, l.token_code, COALESCE(l.display_data->>\'image\') image, COALESCE(l.display_data->>\'title\') title, b.start_time launch_date, t.image token_image, l.created_at_time, l.updated_at_time, l.created_at_block, l.updated_at_block ' +
        'FROM launchbagz_launches l ' +
        'LEFT JOIN neftyblends_blends b ON b.contract = l.blend_contract AND b.blend_id = l.blend_id ' +
        'LEFT JOIN launchbagz_tokens t ON t.token_contract = l.token_contract AND t.token_code = l.token_code'
    );
    if (args.token_contract) {
        query.equalMany('token_contract', args.token_contract.split(',').map((t: string) => t.trim()));
    }
    if (args.token_code) {
        query.equalMany('token_code', args.token_code.split(',').map((t: string) => t.trim()));
    }
    if (args.authorized_account) {
        query.addCondition(`authorized_accounts @> ARRAY[${query.addVariable(args.authorized_account)}]`);
    }
    if (args.is_hidden) {
        query.equal('is_hidden', Boolean(args.is_hidden));
    }

    let dateColumn = 'l.created_at_time';
    if (args.sort === 'updated_at_time') {
        dateColumn = 'l.updated_at_time';
    } else if (args.sort === 'launch_date') {
        dateColumn = 'b.start_time';
    }
    await buildBoundaryFilter(
        params, query, 'l.launch_id', 'int',
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
        token_contract: {column: 'l.token_contract', nullable: false},
        token_code: {column: 'l.token_code', nullable: false},
        created_at_time: {column: 'l.created_at_time', nullable: false},
        updated_at_time: {column: 'l.updated_at_time', nullable: false},
        launch_date: {column: 'b.start_time', nullable: true},
    };

    query.append(`ORDER BY ${sortMapping[args.sort].column} ${args.order} ${sortMapping[args.sort].nullable ? 'NULLS LAST' : ''}`);
    query.append('LIMIT ' + query.addVariable(args.limit) + ' OFFSET ' + query.addVariable((args.page - 1) * args.limit));

    const result = await ctx.db.query(query.buildString(), query.buildValues());
    return result.rows;
}

export async function getLaunchesCount(params: RequestValues, ctx: LaunchesContext): Promise<any> {
    return getLaunches({...params, count: 'true'}, ctx);
}

export async function getLaunchDetail(params: RequestValues, ctx: LaunchesContext): Promise<any> {
    const query = new QueryBuilder('SELECT l.launch_id, l.blend_id, l.blend_contract, l.is_hidden hide, l.token_contract, l.token_code, COALESCE(l.display_data->>\'image\') image, COALESCE(l.display_data->>\'title\') title, l.display_data, t.image token_image, l.created_at_time, l.updated_at_time, l.created_at_block, l.updated_at_block ' +
        'FROM launchbagz_launches l ' +
        'LEFT JOIN launchbagz_tokens t ON t.token_contract = l.token_contract AND t.token_code = l.token_code');
    query.equal('l.contract', ctx.coreArgs.launch_account);
    query.equal('l.launch_id', ctx.pathParams.launch_id);

    const launchResult = await ctx.db.query(query.buildString(), query.buildValues());
    if(launchResult.rows.length < 1){
        throw new ApiError('Launch not found', 416);
    }

    const launch = launchResult.rows[0];
    let blend = null;
    if (launch.blend_id) {
        const blendQuery = new QueryBuilder(`
            SELECT *
            FROM neftyblends_blend_details_master blend_detail
        `);
        blendQuery.equal('blend_detail.blend_id', launch.blend_id);
        blendQuery.equal('blend_detail.contract', launch.blend_contract);

        const result = await ctx.db.query(blendQuery.buildString(), blendQuery.buildValues());
        if (result.rows.length > 0) {
            blend = (await fillBlends(
                ctx.db,
                ctx.coreArgs.atomicassets_account,
                result.rows,
                true,
            ))[0];
        }

        launch.launch_date = blend ? blend.start_time : null;
        launch.blend = blend;
    }
    delete launch['blend_id'];
    delete launch['blend_contract'];
    return launch;
}
