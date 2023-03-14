import {buildBoundaryFilter, RequestValues} from '../../utils';
import {filterQueryArgs} from '../../validation';
import {NeftyDropsContext} from '../index';
import QueryBuilder from '../../../builder';
import {buildDropFilter} from '../utils';
import {buildGreylistFilter} from '../../atomicassets/utils';
import {fillDrops} from '../filler';
import {formatClaim, formatDrop} from '../format';
import {ApiError} from '../../../error';

export async function getDropsAction(params: RequestValues, ctx: NeftyDropsContext): Promise<any> {
    const args = filterQueryArgs(params, {
        page: {type: 'int', min: 1, default: 1},
        limit: {type: 'int', min: 1, max: 100, default: 100},
        collection_name: {type: 'string', min: 1},
        sort_available_first: {type: 'bool', default: false},
        render_markdown: {type: 'bool', default: false},
        hide_description: {type: 'bool', default: false},
        sort: {
            type: 'string',
            allowedValues: [
                'created', 'updated', 'drop_id', 'price',
                'start_time', 'end_time',
            ],
            default: 'created'
        },
        order: {type: 'string', allowedValues: ['asc', 'desc'], default: 'desc'},
        count: {type: 'bool'}
    });

    const query = new QueryBuilder(`
                SELECT ndrop.drop_id 
                FROM neftydrops_drops ndrop 
                    LEFT JOIN neftydrops_drop_prices price ON (price.drops_contract = ndrop.drops_contract AND price.drop_id = ndrop.drop_id)
            `);

    buildDropFilter(params, query);

    if (!args.collection_name) {
        buildGreylistFilter(params, query, {collectionName: 'ndrop.collection_name'});
    }

    let dateColumn = 'ndrop.created_at_time';
    if (args.sort === 'updated') {
        dateColumn = 'ndrop.updated_at_time';
    } else if (args.sort === 'start_time') {
        dateColumn = 'ndrop.start_time';
    } else if (args.sort === 'end_time') {
        dateColumn = 'ndrop.end_time';
    }

    buildBoundaryFilter(
        params, query, 'ndrop.drop_id', 'int',
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
        drop_id: {column: 'ndrop.drop_id', nullable: false},
        created: {column: 'ndrop.created_at_time', nullable: false},
        updated: {column: 'ndrop.updated_at_time', nullable: false},
        start_time: {column: 'ndrop.start_time', nullable: false},
        end_time: {column: 'ndrop.end_time', nullable: false},
        price: {column: 'price.price', nullable: true}
    };

    query.append('ORDER BY ' + (args.sort_available_first === true ? 'is_available DESC NULLS LAST, (CASE WHEN end_time = 0 THEN 1 WHEN end_time < ' + new Date().getTime() + ' THEN 0 ELSE 1 END)::INTEGER DESC NULLS LAST, ' : '') + sortMapping[args.sort].column + ' ' + args.order + ' ' + (sortMapping[args.sort].nullable ? 'NULLS LAST' : ''));
    query.append('LIMIT ' + query.addVariable(args.limit) + ' OFFSET ' + query.addVariable((args.page - 1) * args.limit));

    const dropQuery = await ctx.db.query(query.buildString(), query.buildValues());

    const result = await ctx.db.query(
        'SELECT * FROM neftydrops_drops_master WHERE drops_contract = $1 AND drop_id = ANY ($2)',
        [ctx.coreArgs.neftydrops_account, dropQuery.rows.map(row => row.drop_id)]
    );

    const dropLookup: {[key: string]: any} = {};
    result.rows.reduce((prev, current) => {
        prev[String(current.drop_id)] = current;
        return prev;
    }, dropLookup);

    return fillDrops(
        ctx.db,
        ctx.coreArgs.atomicassets_account,
        dropQuery.rows.map((row) => formatDrop(
            dropLookup[String(row.drop_id)],
            args.hide_description,
            args.render_markdown
        )).filter(x => !!x)
    );
}

export async function getDropsCountAction(params: RequestValues, ctx: NeftyDropsContext): Promise<any> {
    return getDropsAction({...params, count: 'true'}, ctx);
}

export async function getDropsByCollection(params: RequestValues, ctx: NeftyDropsContext): Promise<any> {
    const args = filterQueryArgs(params, {
        page: {type: 'int', min: 1, default: 1},
        limit: {type: 'int', min: 1, max: 100, default: 100},
        drop_limit: {type: 'int', min: 1, max: 50, default: 5},
        collection_name: {type: 'string', min: 1},
        sort_available_first: {type: 'bool', default: false},
        render_markdown: {type: 'bool', default: false},
        hide_description: {type: 'bool', default: true},
        sort: {
            type: 'string',
            allowedValues: [
                'created', 'updated',
                'start_time', 'end_time',
            ],
            default: 'created'
        },
        order: {type: 'string', allowedValues: ['asc', 'desc'], default: 'desc'},
        count: {type: 'bool'}
    });

    const query = new QueryBuilder('');

    buildDropFilter(params, query);

    if (!args.collection_name) {
        buildGreylistFilter(params, query, {collectionName: 'ndrop.collection_name'});
    }

    let dateColumn = 'ndrop.created_at_time';
    if (args.sort === 'updated') {
        dateColumn = 'ndrop.updated_at_time';
    } else if (args.sort === 'start_time') {
        dateColumn = 'ndrop.start_time';
    } else if (args.sort === 'end_time') {
        dateColumn = 'ndrop.end_time';
    }

    buildBoundaryFilter(
        params, query, 'ndrop.drop_id', 'int',
        dateColumn
    );

    const sortMapping: {[key: string]: {column: string}}  = {
        created: {column: 'created_at_time'},
        updated: {column: 'updated_at_time'},
        start_time: {column: 'start_time'},
        end_time: {column: 'end_time'}
    };

    const limitVar = query.addVariable(args.limit);
    const dropLimitVar = query.addVariable(args.drop_limit);
    const offsetVar = query.addVariable((args.page - 1) * args.limit);
    const sortColumn = sortMapping[args.sort].column || 'created_at_time';
    const sortAggregate = args.order === 'desc' ? 'MAX' : 'MIN';

    const queryString = `SELECT collection.${sortColumn}, collection.collection_name, ARRAY_AGG(collection_drops.drop_id) AS drop_ids
        FROM (
            SELECT outer_drops.collection_name, ${sortAggregate}(outer_drops.${sortColumn}) AS ${sortColumn}
            FROM neftydrops_drops outer_drops
            LEFT JOIN neftydrops_drop_prices price ON (price.drops_contract = outer_drops.drops_contract AND price.drop_id = outer_drops.drop_id)
            ${query.buildString().replace(/ndrop\./g, 'outer_drops.')}
            GROUP BY outer_drops.collection_name
            ORDER BY ${sortColumn} ${args.order}
            LIMIT ${limitVar} OFFSET ${offsetVar}
        ) collection
        JOIN LATERAL (
            SELECT ndrop.drop_id
            FROM neftydrops_drops ndrop
            LEFT JOIN neftydrops_drop_prices price ON (price.drops_contract = ndrop.drops_contract AND price.drop_id = ndrop.drop_id)
            ${query.buildString()} AND ndrop.collection_name = collection.collection_name
            ORDER BY ${(args.sort_available_first === true ? 'is_available DESC NULLS LAST, (CASE WHEN end_time = 0 THEN 1 WHEN end_time < ' + new Date().getTime() + ' THEN 0 ELSE 1 END)::INTEGER DESC NULLS LAST, ' : '')} ndrop.${sortColumn} ${args.order}
            LIMIT ${dropLimitVar} 
        ) collection_drops on true
        GROUP BY collection.collection_name, collection.${sortColumn}
        ORDER BY collection.${sortColumn} ${args.order}
    `;

    const dropQuery = await ctx.db.query(queryString, query.buildValues());

    const result = await ctx.db.query(
        'SELECT * FROM neftydrops_drops_master WHERE drops_contract = $1 AND drop_id = ANY ($2)',
        [ctx.coreArgs.neftydrops_account, dropQuery.rows.flatMap(row => row.drop_ids)]
    );

    const dropLookup: {[key: string]: any} = {};
    result.rows.reduce((prev, current) => {
        prev[String(current.drop_id)] = current;
        return prev;
    }, dropLookup);

    const drops = await fillDrops(
        ctx.db,
        ctx.coreArgs.atomicassets_account,
        dropQuery.rows.flatMap(row => row.drop_ids).map(dropId => formatDrop(
            dropLookup[String(dropId)],
            args.hide_description,
            args.render_markdown
        )).filter(x => !!x),
    );

    const dropsMap = drops.reduce((acc, drop) => {
        acc[String(drop.drop_id)] = drop;
        return acc;
    }, {});

    return dropQuery.rows.map(row => ({
        collection: dropsMap[row.drop_ids[0]]?.collection,
        drops: row.drop_ids.map((dropId: any) => ({
            ...dropsMap[String(dropId)],
            collection: undefined,
            templates: undefined,
            collection_name: undefined,
        }))
    }));
}

export async function getDropAction(params: RequestValues, ctx: NeftyDropsContext): Promise<any> {
    const args = filterQueryArgs(params, {
        render_markdown: {type: 'bool', default: false},
    });

    const query = await ctx.db.query(
        'SELECT * FROM neftydrops_drops_master WHERE drops_contract = $1 AND drop_id = $2',
        [ctx.coreArgs.neftydrops_account, ctx.pathParams.drop_id]
    );

    if (query.rowCount === 0) {
        throw new ApiError('Drop not found', 416);
    } else {
        const drops = await fillDrops(
            ctx.db, ctx.coreArgs.atomicassets_account, query.rows.map((row) => formatDrop(
                row,
                false,
                args.render_markdown
            ))
        );
        return drops[0];
    }
}

export async function getDropClaimsAction(params: RequestValues, ctx: NeftyDropsContext): Promise<any> {
    const args = filterQueryArgs(params, {
        page: {type: 'int', min: 1, default: 1},
        limit: {type: 'int', min: 1, max: 100, default: 100},
        sort: {
            type: 'string',
            allowedValues: [
                'claim_time', 'created_at_time', 'price', 'total_price',
                'amount', 'claimer',
            ],
            default: 'claim_time'
        },
        order: {type: 'string', allowedValues: ['asc', 'desc'], default: 'asc'},
        count: {type: 'bool'}
    });

    const query = new QueryBuilder(
        'SELECT claim_id FROM neftydrops_claims WHERE drops_contract = $1 AND drop_id = $2',
        [ctx.coreArgs.neftydrops_account, ctx.pathParams.drop_id]
    );

    if (args.count) {
        const countQuery = await ctx.db.query(
            'SELECT COUNT(*) counter FROM (' + query.buildString() + ') x',
            query.buildValues()
        );

        return countQuery.rows[0].counter;
    }

    const sortMapping: {[key: string]: {column: string, nullable: boolean}}  = {
        claim_time: {column: 'created_at_time', nullable: false},
        created_at_time: {column: 'created_at_time', nullable: false},
        price: {column: 'final_price', nullable: false},
        total_price: {column: 'total_price', nullable: false},
        amount: {column: 'amount', nullable: false},
        claimer: {column: 'claimer', nullable: false},
    };

    query.append('ORDER BY ' + sortMapping[args.sort].column + ' ' + args.order + ' ' + (sortMapping[args.sort].nullable ? 'NULLS LAST' : ''));
    query.append('LIMIT ' + query.addVariable(args.limit) + ' OFFSET ' + query.addVariable((args.page - 1) * args.limit));

    const claimsQuery = await ctx.db.query(query.buildString(), query.buildValues());
    const result = await ctx.db.query(
        'SELECT * FROM neftydrops_claims_master WHERE drops_contract = $1 AND claim_id = ANY ($2)',
        [ctx.coreArgs.neftydrops_account, claimsQuery.rows.map(row => row.claim_id)]
    );

    const claimLookup: {[key: string]: any} = {};
    result.rows.reduce((prev: any, current: any) => {
        prev[String(current.claim_id)] = current;
        return prev;
    }, claimLookup);

    return claimsQuery.rows.map((row) => formatClaim(claimLookup[row.claim_id]));
}

export async function getDropClaimsCountAction(params: RequestValues, ctx: NeftyDropsContext): Promise<any> {
    return getDropClaimsAction({...params, count: 'true'}, ctx);
}

export async function getDropsClaimableAction(params: RequestValues, ctx: NeftyDropsContext): Promise<any> {
    const args = filterQueryArgs(params, {
        drops: {type: 'string', default: ''},
        account: {type: 'string', default: ''},
        keys: {type: 'string', default: ''}
    });

    if (args.account === '') {
        throw new ApiError('Param: \'account\' is required', 400);
    }
    if (args.drops === '') {
        throw new ApiError('Param: \'drops\' is required', 400);
    }

    const drop_ids = args.drops.split(',');
    const keys = (args.keys === '' ? [] : args.keys.split(','));

    let queryVarCounter:number = 0;
    const queryValues:any[] = [];
    let queryString:string;

    queryValues.push(args.account);
    queryValues.push(keys);
    queryValues.push(args.account);
    queryString = `
SELECT
    "drop".drop_id,
    "drop".auth_required as auth_required,
    (
        neftydrops_is_account_in_whitelist(
            $${++queryVarCounter},
            acc_stats.use_counter,
            "drop".drop_id
        )
        OR neftydrops_is_key_authorized($${++queryVarCounter}, "drop".drop_id)
    )as satisfies_first_pass_of_security_checks
FROM neftydrops_drops "drop"
LEFT JOIN neftydrops_account_stats acc_stats ON
    acc_stats.drop_id = "drop".drop_id AND
    acc_stats.claimer = $${++queryVarCounter}`
    ;

    // Only get the drop ids that the user sent
    {
        queryValues.push(drop_ids);
        queryString += `
WHERE
    EXISTS (SELECT FROM UNNEST($${++queryVarCounter}::BIGINT[]) u(c) WHERE u.c = "drop".drop_id)`;
    }

    // Only get the drops that have a valid date and have not reached their max_claims
    {
        queryString += `
    AND (
        ("drop".start_time = 0 OR (cast(extract(epoch from now()) as bigint) * 1000) >= "drop".start_time) AND
        ("drop".end_time = 0 OR (cast(extract(epoch from now()) as bigint) * 1000) <= "drop".end_time) AND
        ("drop".max_claimable = 0 OR "drop".max_claimable > "drop".current_claimed)
    )`;
    }

    // Check if the account passes they account_limit requirements
    {
        queryValues.push(args.account);
        queryString += `
    AND neftydrops_is_account_within_use_limits(
        $${++queryVarCounter},
        acc_stats.use_counter,
        acc_stats.last_claim_time,
        "drop".drop_id,
        "drop".account_limit,
        "drop".account_limit_cooldown
    )`;
    }

    const firstPassResult = await ctx.db.query(queryString, queryValues);

    const claimable_drops = new Set();

    // The reason we do the security checks in 2 different queries is because
    // checking if an account passes the proof of ownership we need to go
    // through all their assets, and if we do that in a function that takes in a
    // single drop_id per call, that would be way too slow

    const pendingDropIds = [];
    for (const row of firstPassResult.rows){
        if(row.auth_required && !row.satisfies_first_pass_of_security_checks) {
            pendingDropIds.push(row.drop_id);
        } else {
            claimable_drops.add(row.drop_id);
        }
    }

    if(pendingDropIds.length > 0){
        const queryValues = [];
        let queryVarCounter = 0;

        queryValues.push(args.account);
        queryValues.push(pendingDropIds);
        const queryString = `
select
    asset_matches_sub.drop_id as "drop_id",
    asset_matches_sub.logical_operator AS "logical_operator",
    count(1) AS "fulfilled_filters",
    asset_matches_sub.total_filter_count AS "total_filter_count"
FROM (
    select
        "filter".drop_id,
        "filter".filter_index,
        "filter".logical_operator,
        "filter".total_filter_count,
        "filter".comparison_operator,
        "filter".nft_amount as "required",
        count(distinct asset.asset_id) as "owned"
    from neftydrops_proof_of_ownership_filters "filter"
    join atomicassets_assets asset ON
        asset.owner=$${++queryVarCounter} AND
        "filter".filter_kind != 'TOKEN_HOLDING' AND
        (
            ("filter".filter_kind = 'COLLECTION_HOLDINGS' AND asset.collection_name = "filter".collection_holdings->>'collection_name') OR
            ("filter".filter_kind = 'SCHEMA_HOLDINGS' AND asset.schema_name = "filter".schema_holdings->>'schema_name' AND "filter".filter_kind = 'SCHEMA_HOLDINGS' AND asset.collection_name = "filter".schema_holdings->>'collection_name') OR
            ("filter".filter_kind = 'TEMPLATE_HOLDINGS' AND asset.template_id = cast("filter".template_holdings->>'template_id' as bigint))
        )
    where
        EXISTS (SELECT FROM UNNEST($${++queryVarCounter}::BIGINT[]) u(c) WHERE u.c = "filter".drop_id)
    group by
        "filter".drop_id,
        "filter".filter_index,
        "filter".total_filter_count,
        "filter".nft_amount
    having
        ("filter".comparison_operator=0 AND count(distinct asset.asset_id) =  "filter".nft_amount) OR
        ("filter".comparison_operator=1 AND count(distinct asset.asset_id) != "filter".nft_amount) OR
        ("filter".comparison_operator=2 AND count(distinct asset.asset_id) >  "filter".nft_amount) OR
        ("filter".comparison_operator=3 AND count(distinct asset.asset_id) >= "filter".nft_amount) OR
        ("filter".comparison_operator=4 AND count(distinct asset.asset_id) <  "filter".nft_amount) OR
        ("filter".comparison_operator=5 AND count(distinct asset.asset_id) <= "filter".nft_amount)
) as asset_matches_sub
GROUP BY
    asset_matches_sub.drop_id,
    asset_matches_sub.logical_operator,
    asset_matches_sub.total_filter_count
HAVING
    (asset_matches_sub.logical_operator=0 AND count(1) >= asset_matches_sub.total_filter_count) OR
    (asset_matches_sub.logical_operator=1);
        `;

        const result = await ctx.db.query(queryString, queryValues);

        for(const row of result.rows){
            claimable_drops.add(row.drop_id);
        }
    }

    return Array.from(claimable_drops);
}
