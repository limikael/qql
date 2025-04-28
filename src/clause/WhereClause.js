const operatorsMap = {
    $eq: '=', $ne: '!=', $gt: '>', $gte: '>=', $lt: '<', $lte: '<=',
    $like: 'LIKE', $notLike: 'NOT LIKE', $in: 'IN', $nin: 'NOT IN', $is: 'IS'
};

const reverseOperatorsMap={
    "=": "$eq", "!=": "$ne",
    ">": "$gt", ">=": "$gte",
    "<": "$lt", "<=": "$lte"
};

TODO !!! pick alias from an obj...

export function canonicalizeCondition(where) {
	if (typeof where!="object")
		throw new Error("Expected object for where clause");

    let retWhere={};

    for (let k in where) {
        let m=k.match(/^([\$\_\w]+)([!=<>~%^]*)$/);
        if (!m)
            throw new Error("Unable to parse where part: "+k);

        //console.log("match",m);
        let name=m[1];
        let op=m[2];
        let val=where[k];

        if (!retWhere.hasOwnProperty(name))
            retWhere[name]={};

        if (name.startsWith("$")) {
        	if (!Array.isArray(val))
        		throw new Error("Expected array");

            retWhere[name]=val.map(w=>canonicalizeCondition(w));
        }

        else if (typeof val=="object") {
        	if (op)
        		throw new Error("Operator at end of string and in object");

            retWhere[name]={...retWhere[name],...val};
        }

        else {
        	if (!op)
        		op="=";

            if (!reverseOperatorsMap[op])
                throw new Error("Unknown op: "+op);

            retWhere[name][reverseOperatorsMap[op]]=val;
        }
    }

    return retWhere;
}

export default class WhereClause {
	constructor({where, tableName, qql, joinCount, alias}) {
		this.qql=qql;
		this.where=canonicalizeCondition(where);
		this.tableName=tableName;
		this.joinCount=joinCount;
		this.alias=alias;

		this.table=this.qql.getTableByName(this.tableName);

		if (!this.joinCount)
			this.joinCount=1;

		this.process();
	}

	escapeId(id) {
		return this.qql.driver.escapeId(id)
	}

	getAliasedName() {
		if (this.alias)
			return this.alias;

		return this.tableName;
	}

	processFieldCondition(fieldName, op, val) {
		let field=this.qql.getTableByName(this.tableName).getFieldByName(fieldName);
		if (!field)
			throw new Error("No field "+fieldName+" for table "+this.tableName);

		if (op=="$ref") {
			let refTable=this.qql.getTableByName(field.reference);
			if (!refTable)
				throw new Error("Field "+fieldName+" of table "+this.tableName+" is not a reference");

			let joinCount=this.joinCount;
			this.joinCount++;

			let refWhere=new WhereClause({
				where: val,
				tableName: field.reference,
				alias: "_j"+joinCount,
				qql: this.qql,
				joinCount: this.joinCount
			});

			this.joinCount+=refWhere.joins.length;

			this.joins.push(
				"LEFT JOIN "+this.escapeId(refTable.name)+" AS _j"+joinCount+
				" ON "+this.escapeId(this.getAliasedName())+"."+this.escapeId(field.name)+
				"=_j"+joinCount+"."+this.escapeId(refTable.getPrimaryKeyField().name)
			);

			this.clauses.push(...refWhere.clauses);
			this.values.push(...refWhere.values);
			this.joins.push(...refWhere.joins);
			return;
		}

		if (!operatorsMap[op])
			throw new Error("Unknown op: "+op);

		if (this.alias)
			this.clauses.push(
				this.escapeId(this.alias)+"."+
				this.escapeId(fieldName)+
				operatorsMap[op]+"?");

		else
			this.clauses.push(this.qql.driver.escapeId(fieldName)+operatorsMap[op]+"?");

		this.values.push(val);
	}

	processFieldConditions(fieldName, conds) {
		for (let k in conds) {
			this.processFieldCondition(fieldName, k, conds[k]);
		}
	}

	processLogical(op, whereConds) {
		let subClauses=[];
		let logOps={
			$and: "AND",
			$or: "OR"
		}

		for (let whereCond of whereConds) {
			let subWhere=new WhereClause({
				where: whereCond,
				tableName: this.tableName,
				alias: this.alias,
				qql: this.qql,
				joinCount: this.joinCount
			});

			subClauses.push(subWhere.clauses.join(" AND "));
			this.values.push(...subWhere.values);
			this.joins.push(...subWhere.joins);
		}

		this.clauses.push("("+subClauses.join(" "+logOps[op]+" ")+")");
	}

	process() {
		this.clauses=[];
		this.values=[];
		this.joins=[];

		for (let k in this.where) {
			if (["$or","$and"].includes(k))
				this.processLogical(k,this.where[k])

			else
				this.processFieldConditions(k, this.where[k]);
		}
	}

	getValues() {
		return this.values;
	}

	getJoins() {
		return this.joins;
	}

	getJoinClause() {
		return this.joins.join(" ");
	}

	getWhereClause() {
		let clause="";
		if (this.clauses.length)
			clause="WHERE "+this.clauses.join(" AND ");

		return clause;
	}
}