import { isWeakIntArray } from '../utils';

export default class QueryBuilder {
    private baseQuery: string;

    private conditions: string[] = [];
    private aggregations: string[] = [];
    private havingConditions: string[] = [];
    private ending: string = '';

    private variables: any[];

    constructor(query: string, variables: any[] = []) {
        this.variables = variables;

        this.baseQuery = query;
    }

    addVariable(value: any): string {
        const existingVariable = this.variables.indexOf(value) + 1;
        if (existingVariable) {
            return `$${existingVariable}`;
        }

        return `$${this.variables.push(value)}`;
    }

    join(tableA: string, tableB: string, columns: string[]): QueryBuilder {
        for (const column of columns) {
            this.conditions.push(tableA + '.' + column + ' = ' + tableB + '.' + column);
        }

        return this;
    }

    equal(column: string, value: any): QueryBuilder {
        this.conditions.push(column + ' = ' + this.addVariable(value));

        return this;
    }

    unequal(column: string, value: any): QueryBuilder {
        this.conditions.push(column + ' != ' + this.addVariable(value));

        return this;
    }

    equalMany(column: string, values: any[]): QueryBuilder {
        if (!Array.isArray(values)) {
            throw new Error('equalMany only accepts arrays as value');
        }

        if (values.length === 1) {
            return this.equal(column, values[0]);
        }

        if (values.length > 10) {
            const isNumber = !column.endsWith('collection_name') && isWeakIntArray(values);
            this.conditions.push(`EXISTS (SELECT FROM UNNEST(${this.addVariable(values)}::${isNumber ? 'BIGINT' : 'TEXT'}[]) u(c) WHERE u.c = ${column})`);
        } else {
            this.conditions.push(`${column} = ANY(${this.addVariable(values)})`);
        }

        return this;
    }

    notMany(column: string, values: any[], includeNull: boolean = false): QueryBuilder {
        if (!Array.isArray(values)) {
            throw new Error('notMany only accepts arrays as value');
        }

        const queryString: string[] = [];

        if (values.length === 1) {
            return this.unequal(column, values[0]);
        }

        if (values.length > 10) {
            queryString.push(`NOT EXISTS (SELECT FROM UNNEST(${this.addVariable(values)}::${isWeakIntArray(values) ? 'BIGINT' : 'TEXT'}[]) u(c) WHERE u.c = ${column})`);
        } else {
            queryString.push(`${column} != ALL(${this.addVariable(values)})`);
        }

        if (includeNull) {
            queryString.push(`${column} IS NULL`);
        }

        this.conditions.push(`(${queryString.join(' OR ')})`);

        return this;
    }

    notNull(column: string): QueryBuilder {
        this.conditions.push(column + ' IS NOT NULL');

        return this;
    }

    isNull(column: string): QueryBuilder {
        this.conditions.push(column + ' IS NULL');

        return this;
    }

    addCondition(text: string): QueryBuilder {
        this.conditions.push(`(${text})`);

        return this;
    }

    group(columns: string[]): QueryBuilder {
        this.aggregations = [...this.aggregations, ...columns];

        return this;
    }

    having(condition: string): QueryBuilder {
        this.havingConditions.push(condition);

        return this;
    }

    paginate(page: number, limit: number): QueryBuilder {
        this.append('LIMIT ' + this.addVariable(limit) + ' OFFSET ' + this.addVariable((page - 1) * limit));

        return this;
    }

    append(text: string): QueryBuilder {
        this.ending += text + ' ';

        return this;
    }

    appendToBase(text: string): QueryBuilder {
        this.baseQuery += text + ' ';

        return this;
    }

    setVars(vars: any[]): QueryBuilder {
        this.variables = vars;

        return this;
    }

    escapeLikeVariable(s: string): string {
        return s.replace('%', '\\%').replace('_', '\\_');
    }

    buildString(): string {
        let queryString = this.baseQuery + ' ';

        if (this.conditions.length > 0) {
            queryString += 'WHERE ' + this.conditions.join(' AND ') + ' ';
        }

        if (this.aggregations.length > 0) {
            queryString += 'GROUP BY ' + this.aggregations.join(', ') + ' ';
        }

        if (this.havingConditions.length > 0) {
            queryString += 'HAVING ' + this.havingConditions.join(' AND ') + ' ';
        }

        if (this.ending) {
            queryString += this.ending + ' ';
        }

        return queryString;
    }

    buildValues(): any[] {
        return this.variables;
    }

}
