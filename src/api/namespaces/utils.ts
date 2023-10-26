import * as express from 'express';
import QueryBuilder from '../builder';
import {filterQueryArgs, FiltersDefinition, FilterValues} from './validation';
import {Remarkable} from 'remarkable';
import {linkify} from 'remarkable/linkify';
import * as sanitizeHtml from 'sanitize-html';

const md = new Remarkable({
    html: true,
    xhtmlOut: true,
    breaks: true,
}).use(linkify);

export type SortColumn = {column: string, nullable?: boolean, numericIndex?: boolean};
export type SortColumnMapping = {[key: string]: SortColumn};

export type FilterDefinition = {
    [key: string]: {
        type: 'string' | 'string[]' | 'int' | 'float' | 'bool',
        min?: number,
        max?: number,
        default?: any,
        values?: any[]
    }
};

export type RequestValues = {[key: string]: any};

export function mergeRequestData(req: express.Request): RequestValues {
    return {...req.query, ...req.body};
}

export async function buildBoundaryFilter(
    values: FilterValues, query: QueryBuilder,
    primaryColumn: string, primaryType: 'string' | 'int',
    dateColumn: string | null
): Promise<void> {
    const filters: FiltersDefinition = {
        lower_bound: {type: primaryType, min: 1},
        upper_bound: {type: primaryType, min: 1},
        before: {type: 'int', min: 1},
        after: {type: 'int', min: 1},
        ids: {type: 'list[string]'},
    };
    let primaryColumnName;

    if (primaryColumn) {
        primaryColumnName = primaryColumn.split('.')[1] || primaryColumn;
        filters[primaryColumnName] = {type: 'list[string]'};
    }
    const args = await filterQueryArgs(values, filters);

    if (primaryColumn && (args.ids.length || args[primaryColumnName].length)) {
        query.equalMany(primaryColumn, [...args.ids, ...args[primaryColumnName]]);
    }

    if (primaryColumn && args.lower_bound) {
        query.addCondition(primaryColumn + ' >= ' + query.addVariable(args.lower_bound));
    }

    if (primaryColumn && args.upper_bound) {
        query.addCondition(primaryColumn + ' < ' + query.addVariable(args.upper_bound));
    }

    if (dateColumn && args.before) {
        query.addCondition(dateColumn + ' < ' + query.addVariable(args.before) + '::BIGINT');
    }

    if (dateColumn && args.after) {
        query.addCondition(dateColumn + ' > ' + query.addVariable(args.after) + '::BIGINT');
    }
}

export function renderMarkdownToHtml(markdown: string): string {
    return sanitizeHtml(md.render(markdown), {
        allowedTags: [
            'img',
            'p',
            'h1',
            'h2',
            'h3',
            'h4',
            'h5',
            'h6',
            'br',
            'ol',
            'ul',
            'li',
            'em',
            'a',
            'strong',
            'blockquote',
        ],
    });
}
