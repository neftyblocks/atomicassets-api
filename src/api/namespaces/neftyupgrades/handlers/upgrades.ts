import {RequestValues} from '../../utils';
import {NeftyUpgradesContext} from '../index';
import QueryBuilder from '../../../builder';
import { ApiError } from '../../../error';
import {filterQueryArgs} from '../../validation';
import {fillUpgrades, fillClaims} from '../filler';
import {formatClaim} from '../format';

export async function getUpgradeCategories(params: RequestValues, ctx: NeftyUpgradesContext): Promise<any> {
    const args = await filterQueryArgs(params, {
        page: {type: 'int', min: 1, default: 1},
        limit: {type: 'int', min: 1, max: 1000, default: 100},
        sort: {type: 'string', allowedValues: ['category'], default: 'category'},
        order: {type: 'string', allowedValues: ['asc', 'desc'], default: 'asc'},

        collection_name: {type: 'string', default: ''},
    });

    const query = new QueryBuilder('SELECT category, COUNT(*) as count  FROM neftyupgrades_upgrades');

    if (args.collection_name) {
        query.equal('collection_name', args.collection_name);
    }

    query.addCondition('category IS NOT NULL AND trim(category) <> \'\'');
    query.append('GROUP BY category');

    const sortMapping: {[key: string]: {column: string, nullable: boolean}}  = {
        category: {column: 'category', nullable: false},
    };

    query.append(`ORDER BY ${sortMapping[args.sort].column} ${args.order} ${sortMapping[args.sort].nullable ? 'NULLS LAST' : ''}`);
    query.append('LIMIT ' + query.addVariable(args.limit) + ' OFFSET ' + query.addVariable((args.page - 1) * args.limit));

    const result = await ctx.db.query(query.buildString(), query.buildValues());
    return result.rows.map((row) => ({ category: row.category, count: parseInt(row.count, 10) }));
}

export async function getIngredientOwnershipUpgradeFilter(params: RequestValues, ctx: NeftyUpgradesContext): Promise<any> {
    const args = await filterQueryArgs(params, {
        search: {type: 'string', min: 1},
        page: {type: 'int', min: 1, default: 1},
        limit: {type: 'int', min: 1, max: 1000, default: 100},
        sort_available_first: {type: 'bool', default: false},
        sort: {type: 'string', allowedValues: ['upgrade_id', 'created_at_time'], default: 'upgrade_id'},
        order: {type: 'string', allowedValues: ['asc', 'desc'], default: 'desc'},

        collection_name: {type: 'string', default: ''},
        ingredient_owner: {type: 'string', default: ''},
        ingredient_match: {type: 'string', allowedValues: ['all', 'missing_x', 'any'], default: 'any'},
        missing_ingredients: {type: 'int', min: 1, default: 1},
        available_only: {type: 'bool', default: false},
        visibility: {type: 'string', allowedValues: ['all', 'visible', 'hidden'], default: 'all'},
        category: {type: 'string', default: ''},
        render_markdown: {type: 'bool', default: false},
        count: {type: 'bool'}
    });

    let queryVarCounter:number = 0;
    const queryValues:any[] = [];
    let queryString:string;
    // If we don't have to figure out if the owner has the assets required to
    // execute the upgrade the query is a lot simpler, basically just upgrade_details
    // view
    if(args.ingredient_owner === ''){
        const query = new QueryBuilder('SELECT upgrade_detail.contract, upgrade_detail.upgrade_id FROM neftyupgrades_upgrades upgrade_detail');
        if(args.collection_name !== ''){
            query.equal('upgrade_detail.collection_name', args.collection_name);
        }

        if(args.available_only){
            query.addCondition(`
                (upgrade_detail.start_time = 0 OR (cast(extract(epoch from now()) as bigint) * 1000) >= upgrade_detail.start_time) AND
                (upgrade_detail.end_time = 0 OR (cast(extract(epoch from now()) as bigint) * 1000) <= upgrade_detail.end_time) AND
                (upgrade_detail.max = 0 OR upgrade_detail.max > upgrade_detail.use_count)
            `);
        }

        if (args.visibility === 'visible') {
            query.equal('upgrade_detail.is_hidden', 'FALSE');
        } else if (args.visibility === 'hidden') {
            query.equal('upgrade_detail.is_hidden', 'TRUE');
        }
        if (args.category !== '') {
            query.equal('upgrade_detail.category', args.category);
        }

        if (args.search) {
            query.addCondition(
                `(${query.addVariable(args.search)} <% upgrade_detail.name)`
            );
        }

        queryString = query.buildString();
        queryValues.push(...query.buildValues());
        queryVarCounter = queryValues.length;
    }
    else{
        if(args.collection_name === '') {
            throw new ApiError('Param: \'collection_name\' is required when param \'ingredient_owner\' is sent', 400);
        }

        queryString=`
        SELECT
            upgrade_detail.contract,
            upgrade_detail.upgrade_id,
            upgrade_detail.fulfilled,
            upgrade_detail.end_time,
            upgrade_detail.is_available
        FROM
        (
            SELECT
                asset_matches_sub.contract,
                asset_matches_sub.upgrade_id,
                asset_matches_sub.end_time,
                asset_matches_sub.is_available,
                asset_matches_sub.ingredients_count AS "required",
                sum(asset_matches_sub.fulfilled) AS "fulfilled"
            FROM(
              SELECT
                    b.contract,
                    b.upgrade_id,
                    b.end_time,
                    b.is_available,
                    b.ingredients_count,
                    i.ingredient_index,
                    i.amount AS "required",
                    count(DISTINCT a.asset_id) AS "owned",
                    least(i.amount, count(DISTINCT a.asset_id) + count(DISTINCT i.ingredient_index) FILTER (WHERE i.ingredient_type = 'FT_INGREDIENT')) AS fulfilled
                FROM
                    neftyupgrades_upgrades b
                    JOIN neftyupgrades_upgrade_ingredients i ON
                        b.contract = i.contract AND b.upgrade_id = i.upgrade_id AND i.ingredient_type != 'TOKEN_INGREDIENT'
                    LEFT JOIN atomicassets_assets a ON
                        ((i.ingredient_type = 'TEMPLATE_INGREDIENT' AND a.template_id = i.template_id) OR
                        (i.ingredient_type = 'SCHEMA_INGREDIENT' AND a.schema_name = i.schema_name AND a.collection_name = i.ingredient_collection_name) OR
                        (i.ingredient_type = 'COLLECTION_INGREDIENT' AND a.collection_name = i.ingredient_collection_name) OR
                        (i.ingredient_type = 'ATTRIBUTE_INGREDIENT'
                            AND a.schema_name = i.schema_name AND a.collection_name = i.ingredient_collection_name
                            AND is_upgrade_ingredient_attribute_match(a.template_id, b.upgrade_id, i.ingredient_index, i.total_attributes)) OR
                        (i.ingredient_type = 'TYPED_ATTRIBUTE_INGREDIENT'
                            AND a.schema_name = i.schema_name AND a.collection_name = i.ingredient_collection_name
                            AND is_upgrade_ingredient_attribute_match(a.template_id, b.upgrade_id, i.ingredient_index, i.total_attributes)) OR
                        (
                            i.ingredient_type = 'BALANCE_INGREDIENT' AND
                            a.template_id = i.template_id AND
                            (
                                (a.mutable_data->>i.balance_ingredient_attribute_name)::numeric >= i.balance_ingredient_cost
                            )
                        )) AND a.owner = ${'$' + (++queryVarCounter)} WHERE`
            ;

        // add `WHERE` conditions in filter subquery:
        queryValues.push(args.ingredient_owner);

        // upgrades in collection
        queryValues.push(args.collection_name);
        queryString += `
            b.collection_name = $${++queryVarCounter}`
        ;

        if(args.available_only){
            queryString += `
                AND (
                    (b.start_time = 0 OR (cast(extract(epoch from now()) as bigint) * 1000) >= b.start_time) AND
                    (b.end_time = 0 OR (cast(extract(epoch from now()) as bigint) * 1000) <= b.end_time) AND
                    (b.max = 0 OR b.max > b.use_count)
                )`
            ;
        }
        if (args.visibility === 'visible') {
            queryString += `
                AND b.is_hidden = FALSE
            `;
        } else if (args.visibility === 'hidden') {
            queryString += `
                AND b.is_hidden = TRUE
            `;
        }
        if (args.category !== '') {
            queryValues.push(args.category);
            queryString += ` AND b.category = $${++queryVarCounter}`;
        }

        if (args.search) {
            queryValues.push(args.search);
            queryString += ` AND $${++queryVarCounter} <% b.name = `;
        }

        queryString += `
                GROUP BY
                    b.contract,
                    b.upgrade_id,
                    b.ingredients_count,
                    i.ingredient_index,
                    i.amount
            ) as asset_matches_sub
            GROUP BY
                asset_matches_sub.contract, 
                asset_matches_sub.upgrade_id,
                asset_matches_sub.ingredients_count,
                asset_matches_sub.end_time,
                asset_matches_sub.is_available
            HAVING 
        `;
        if (args.ingredient_match === 'all') {
            queryString += `
                SUM(asset_matches_sub.fulfilled) >= asset_matches_sub.ingredients_count
            `;
        } else if (args.ingredient_match === 'missing_x') {
            queryString += `
                SUM(asset_matches_sub.fulfilled) = asset_matches_sub.ingredients_count - ${args.missing_ingredients}
            `;
        } else { // Have at least one
            queryString += `
                SUM(asset_matches_sub.fulfilled) >= 1
            `;
        }

        queryString += `
        ) as upgrade_detail`;
    }

    if (args.count) {
        const countQuery = await ctx.db.query(
            'SELECT COUNT(*) counter FROM (' + queryString + ') x',
            queryValues
        );

        return countQuery.rows[0].counter;
    }
    queryString += ` ORDER BY ${(args.sort_available_first === true ? '(CASE WHEN upgrade_detail.end_time < ' + Date.now() + ' AND upgrade_detail.end_time != 0 THEN 0 WHEN upgrade_detail.is_available THEN 2 ELSE 1 END)::INTEGER DESC NULLS LAST, ' : '')} (CASE WHEN upgrade_detail.contract = 'upgradeerizerx' THEN 0 ELSE 1 END)::INTEGER DESC NULLS LAST, upgrade_detail.${args.sort} ${args.order}`;

    queryValues.push(args.limit);
    queryString += ` LIMIT $${++queryVarCounter}`;

    queryValues.push((args.page - 1) * args.limit);
    queryString += ` OFFSET $${++queryVarCounter};`;

    const ids = await ctx.db.query(queryString, queryValues);
    if (ids.rows.length === 0) {
        return [];
    }

    const result = await ctx.db.query('' +
        'SELECT * FROM neftyupgrades_upgrade_details_master ' +
        'WHERE (contract, upgrade_id) ' +
        'IN (' + ids.rows.map((row: any) => `('${row.contract}', ${row.upgrade_id})`).join(',') + ')'
    );

    const upgradeLookup: {[key: string]: any} = {};
    result.rows.reduce((prev, current) => {
        prev[`${current.contract}-${current.upgrade_id}`] = current;
        return prev;
    }, upgradeLookup);

    return await fillUpgrades(
        ctx.db,
        ctx.coreArgs.atomicassets_account,
        ids.rows.map((row: any) => upgradeLookup[`${row.contract}-${row.upgrade_id}`]),
        args.render_markdown
    );
}

export async function getIngredientOwnershipUpgradeFilterCount(params: RequestValues, ctx: NeftyUpgradesContext): Promise<any> {
    return getIngredientOwnershipUpgradeFilter({...params, count: 'true'}, ctx);
}

export async function getUpgradeDetails(params: RequestValues, ctx: NeftyUpgradesContext): Promise<any> {
    const args = await filterQueryArgs(params, {
        render_markdown: {type: 'bool', default: false},
    });

    const query = new QueryBuilder(`
        SELECT *  FROM neftyupgrades_upgrade_details_master upgrade_detail
    `);
    query.equal('upgrade_detail.upgrade_id', ctx.pathParams.upgrade_id);
    query.equal('upgrade_detail.contract', ctx.coreArgs.upgrades_account);

    const result = await ctx.db.query(query.buildString(), query.buildValues());
    if(result.rows.length < 1){
        return null;
    }
    else{
        const filledUpgrades = await fillUpgrades(
            ctx.db,
            ctx.coreArgs.atomicassets_account,
            result.rows,
            args.render_markdown
        );
        return filledUpgrades[0];
    }
}

export async function getUpgradeClaimsAction(params: RequestValues, ctx: NeftyUpgradesContext): Promise<any> {
    const args = await filterQueryArgs(params, {
        page: {type: 'int', min: 1, default: 1},
        limit: {type: 'int', min: 1, max: 100, default: 100},
        tx_id: {type: 'string', default: ''},
        sort: {
            type: 'string',
            allowedValues: [
                'claim_time', 'created_at_time',
                'claimer',
            ],
            default: 'claim_time'
        },
        order: {type: 'string', allowedValues: ['asc', 'desc'], default: 'asc'},
        count: {type: 'bool'}
    });

    const query = new QueryBuilder('SELECT * FROM neftyupgrades_claims');
    query.equal('contract', ctx.coreArgs.upgrades_account);
    query.equal('upgrade_id', ctx.pathParams.upgrade_id);

    if (args.tx_id && args.tx_id !== '') {
        const bytes = Buffer.from(args.tx_id, 'hex');
        query.equal('txid', bytes);
    }

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
        claimer: {column: 'claimer', nullable: false},
    };

    query.append('ORDER BY ' + sortMapping[args.sort].column + ' ' + args.order + ' ' + (sortMapping[args.sort].nullable ? 'NULLS LAST' : ''));
    query.append('LIMIT ' + query.addVariable(args.limit) + ' OFFSET ' + query.addVariable((args.page - 1) * args.limit));

    const result = await ctx.db.query(query.buildString(), query.buildValues());
    const filledClaims = await fillClaims(
        ctx.db,
        ctx.coreArgs.atomicassets_account,
        result.rows
    );
    return filledClaims.map((row) => formatClaim(row));
}

export async function getUpgradeClaimsCountAction(params: RequestValues, ctx: NeftyUpgradesContext): Promise<any> {
    return getUpgradeClaimsAction({...params, count: 'true'}, ctx);
}
