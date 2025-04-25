const operatorsMap = {
    $eq: '=', $ne: '!=', $gt: '>', $gte: '>=', $lt: '<', $lte: '<=',
    $like: 'LIKE', $notLike: 'NOT LIKE', $in: 'IN', $nin: 'NOT IN', $is: 'IS'
};

const reverseOperatorsMap={
    "=": "$eq", "!=": "$ne",
    ">": "$gt", ">=": "$gte",
    "<": "$lt", "<=": "$lte"
};

function validateField(field, value, table) {
    const def = table.fields[field];
    if (!def /*|| !def.filter*/) return null;
    return def;
}

/*function buildJoin(refTable, alias, mainTable, mainTablePkField) {
    return `LEFT JOIN ${refTable} AS ${alias} ON ${alias}.${mainTablePkField} = ${mainTable}.${mainTablePkField}`;
}*/

function parseFieldCondition(field, value, tableAlias, table, schema, joins, joinMap, parentTableName) {
    const def = validateField(field, value, table);
    //if (!def) return { clauses: [], values: [] };
    if (!def)
        throw new Error("Unknown field: "+field);

    const clauses = [];
    const values = [];

    if (value && typeof value === 'object' && '$ref' in value && def.ref) {
        const refTableName = def.ref;
        const refTable = schema.tables[refTableName];
        if (!refTable) throw new Error(`Missing schema for referenced table: ${refTableName}`);

        const refPrimaryKey = refTable.getPrimaryKeyFieldName();
        const joinKey = `${refTableName}_${field}`;
        if (!joinMap[joinKey]) {
            const alias = `${refTableName}_` + Object.keys(joinMap).length;
            joinMap[joinKey] = alias;
            joins.push(`LEFT JOIN ${refTableName} AS ${alias} ON ${alias}.${refPrimaryKey} = ${parentTableName}.${field}`);
        }

        const alias = joinMap[joinKey];
        const { clause, values: subValues } = parseCondition(value.$ref, alias, schema, joins, joinMap, refTableName);
        if (clause) {
            clauses.push(`(${clause})`);
            values.push(...subValues);
        }

        return { clauses, values };
    }

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        for (const op in value) {
            const sqlOp = operatorsMap[op];
            const opVal = value[op];

            //if (!sqlOp) continue;
            if (!sqlOp)
                throw new Error("unknown op: "+op);

            //console.log("slqop:",sqlOp);

            if (sqlOp === 'IS' && (opVal === null || opVal === 'NULL')) {
                clauses.push(`${tableAlias}.${field} IS NULL`);
            } else if ((op === '$in' || op === '$nin') && Array.isArray(opVal)) {
                clauses.push(`${tableAlias}.${field} ${sqlOp} (${opVal.map(() => '?').join(', ')})`);
                values.push(...opVal);
            } else if (sqlOp=="=" && opVal===null) {
                clauses.push(`${tableAlias}.${field} IS NULL`);
            } else {
                clauses.push(`${tableAlias}.${field} ${sqlOp} ?`);
                values.push(opVal);
            }
        }
    } else if (value===null) {
        clauses.push(`${tableAlias}.${field} IS NULL`);
    } else {
        clauses.push(`${tableAlias}.${field} = ?`);
        values.push(value);
    }

    return { clauses, values };
}

function parseLogicalOperator(operator, conditions, tableAlias, schema, joins, joinMap, actualTableName) {
    const allClauses = [];
    const allValues = [];

    for (const condition of conditions) {
        const { clause, values } = parseCondition(condition, tableAlias, schema, joins, joinMap, actualTableName);
        if (clause) {
            allClauses.push(`(${clause})`);
            allValues.push(...values);
        }
    }

    return {
        clause: allClauses.join(` ${operator === '$and' ? 'AND' : 'OR'} `),
        values: allValues
    };
}

export function canonicalizeCondition(where) {
    let retWhere={};

    for (let k in where) {
        let m=k.match(/^([\$\_\w+)([!=<>~%^]*)$/);
        if (!m)
            throw new Error("Unable to parse where part: "+k);

        //console.log("match",m);
        let name=m[1];
        let op=m[2];
        let val=where[k];

        if (!op) {
            if (retWhere[name])
                throw new Error("Operator in string and as object can't be used together.");

            retWhere[name]=val;
        }

        else {
            if (retWhere.hasOwnProperty(name) && typeof retWhere[name]!="object")
                throw new Error("Operator in string and as object can't be used together.");

            if (retWhere[name]===undefined)
                retWhere[name]={};

            if (!reverseOperatorsMap[op])
                throw new Error("Unknown op: "+op);

            retWhere[name][reverseOperatorsMap[op]]=val;
        }
    }

    return retWhere;
}

function parseCondition(obj, tableAlias, schema, joins, joinMap, actualTableName) {
    //console.log("before",JSON.stringify(obj));
    obj=canonicalizeCondition(obj);
    //console.log("after",JSON.stringify(obj));

    const table = schema.tables[actualTableName];
    if (!table) throw new Error(`Schema for table '${actualTableName}' not found`);

    const clauses = [];
    const values = [];

    for (const key in obj) {
        if (key === '$and' || key === '$or') {
            const { clause, values: subValues } = parseLogicalOperator(key, obj[key], tableAlias, schema, joins, joinMap, actualTableName);
            if (clause) {
                clauses.push(clause);
                values.push(...subValues);
            }
        } else {
            if (!table.fields[key])
                throw new Error("No such field: "+key+" in table: "+actualTableName);
            const { clauses: fieldClauses, values: fieldValues } = parseFieldCondition(
                key, obj[key], tableAlias, table, schema, joins, joinMap, actualTableName
            );
            clauses.push(...fieldClauses);
            values.push(...fieldValues);
        }
    }

    return {
        clause: clauses.join(' AND '),
        values
    };
}

export function createWhereClause(query, mainTableName, schema) {
    const joins = [];
    const joinMap = {};
    const { clause, values } = parseCondition(query, mainTableName, schema, joins, joinMap, mainTableName);
    return {
        clause: clause ? `WHERE ${clause}` : '',
        values,
        joins
    };
}
