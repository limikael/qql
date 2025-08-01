import IdGenerator from "../utils/IdGenerator.js";
import {qfill} from "../lib/qql-util.js";

const operatorsMap = {
    $eq: '=', $ne: '!=', $gt: '>', $gte: '>=', $lt: '<', $lte: '<=',
    $like: 'LIKE', $notLike: 'NOT LIKE', $in: 'IN', $nin: 'NOT IN', $is: 'IS'
};

const reverseOperatorsMap={
    "=": "$eq", "!=": "$ne",
    ">": "$gt", ">=": "$gte",
    "<": "$lt", "<=": "$lte",
    "~": "$includes"
};

export function canonicalizeCondition(where) {
	if (where===undefined)
		where={};

	if (typeof where!="object")
		throw new Error("Expected object for where clause, got: "+String(where));

    let retWhere={};

    for (let k in where) {
        let m=k.match(/^([\$\_\w]+)([!=<>~%^]*)$/);
        if (!m)
            throw new Error("Unable to parse where part: "+k);

        //console.log("match",m);
        let name=m[1];
        let op=m[2];
        let val=where[k];

        if (val===undefined)
        	throw new Error("where cond cannot be undefined for "+k);

        if (!retWhere.hasOwnProperty(name))
            retWhere[name]={};

        if (name.startsWith("$")) {
        	if (!Array.isArray(val))
        		throw new Error("Expected array for logical condition");

            retWhere[name]=val.map(w=>canonicalizeCondition(w));
        }

        else if (typeof val=="object" && !Array.isArray(val) && val!==null) {
        	if (op)
        		throw new Error("Operator at end of string and in object");

            retWhere[name]={...retWhere[name],...val};
        }

        else {
        	if (!op && Array.isArray(val)) {
	            retWhere[name]["$in"]=val;
        	}

        	else {
	        	if (!op)
	        		op="=";

	            if (!reverseOperatorsMap[op])
	                throw new Error("Unknown op: "+op);

	            retWhere[name][reverseOperatorsMap[op]]=val;
        	}
        }
    }

    return retWhere;
}

export default class WhereClause {
	constructor({where, tableName, qql, idGenerator, alias}) {
		this.qql=qql;
		this.where=canonicalizeCondition(where);
		this.tableName=tableName;
		this.idGenerator=idGenerator;
		this.alias=alias;

		this.table=this.qql.getTableByName(this.tableName);

		if (!this.idGenerator)
			this.idGenerator=new IdGenerator();

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

	processFieldRefCondition(fieldName, whereCond) {
		let field=this.qql.getTableByName(this.tableName).getFieldByName(fieldName);

		let refTable=this.qql.getTableByName(field.reference);
		if (!refTable)
			throw new Error("Field "+fieldName+" of table "+this.tableName+" is not a reference");

		let refAlias="_j"+this.idGenerator.pick();
		let refWhere=new WhereClause({
			where: whereCond,
			tableName: field.reference,
			alias: refAlias,
			qql: this.qql,
			idGenerator: this.idGenerator
		});

		this.joins.push(
			"LEFT JOIN "+this.escapeId(refTable.name)+" AS "+this.escapeId(refAlias)+
			" ON "+this.escapeId(this.getAliasedName())+"."+this.escapeId(field.name)+
			"="+this.escapeId(refAlias)+"."+this.escapeId(refTable.getPrimaryKeyField().name)
		);

		this.clauses.push(...refWhere.clauses);
		this.values.push(...refWhere.values);
		this.joins.push(...refWhere.joins);
	}

	processFieldCondition(fieldName, op, val) {
		let field=this.qql.getTableByName(this.tableName).getFieldByName(fieldName);
		if (!field)
			throw new Error("No field "+fieldName+" for table "+this.tableName);

		if (op=="$ref") {
			this.processFieldRefCondition(fieldName, val);
		}

		else {
			let escapedFieldName=
				this.escapeId(this.tableName)+"."+
				this.qql.driver.escapeId(fieldName);

			if (this.alias)
				escapedFieldName=
					this.escapeId(this.alias)+"."+
					this.escapeId(fieldName);

			if (op=="$includes") {
				this.clauses.push("UPPER("+escapedFieldName+") LIKE ?");
				this.values.push("%"+String(val).toUpperCase()+"%");
			}

			else if (op=="$in") {
				if (!Array.isArray(val))
					throw new Error("Expected array for in operator");

				this.clauses.push(escapedFieldName+" IN ("+qfill(val.length)+")");
				this.values.push(...val);
			}

			else if (op=="$nin") {
				if (!Array.isArray(val))
					throw new Error("Expected array for in operator");

				this.clauses.push(escapedFieldName+" NOT IN ("+qfill(val.length)+")");
				this.values.push(...val);
			}

			else if (op=="$eq" && val===null) {
				this.clauses.push(escapedFieldName+" IS NULL ");
			}

			else {
				if (!operatorsMap[op])
					throw new Error("Unknown op: "+op);

				this.clauses.push(escapedFieldName+operatorsMap[op]+"?");
				this.values.push(val);
			}
		}
	}

	processFieldConditions(fieldName, conds) {
		for (let k in conds) {
			this.processFieldCondition(fieldName, k, conds[k]);
		}
	}

	processLogical(op, whereConds) {
		let subClauses=[], subValues=[], subJoins=[];
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
				idGenerator: this.idGenerator
			});

			if (subWhere.clauses.length) {
				subClauses.push(subWhere.clauses.join(" AND "));
				subValues.push(...subWhere.values);
				subJoins.push(...subWhere.joins);
			}

			else if (op=="$or")
				return;
		}

		if (subClauses.length) {
			this.clauses.push("("+subClauses.join(" "+logOps[op]+" ")+")");
			this.values.push(...subValues);
			this.joins.push(...subJoins);
		}
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

	async matchFieldRefCondition(record, fieldName, whereCond, mode) {
		let field=this.qql.getTableByName(this.tableName).getFieldByName(fieldName);
		let refTable=this.qql.getTableByName(field.reference);
		let refPkFieldName=refTable.getPrimaryKeyField().name;

		if (!record[fieldName])
			return false;

		//console.log("match field ref cond ",record);

		let refRecord=await this.qql({
			oneFrom: refTable.name,
			where: {[refPkFieldName]: record[fieldName]}
		});

		let refWhere=new WhereClause({
			tableName: refTable.name,
			where: whereCond,
			qql: this.qql
		});

		return await refWhere.match(refRecord,mode);
	}

	async matchFieldCondition(record, fieldName, op, val, mode) {
		if (mode=="compatible" && !record.hasOwnProperty(fieldName))
			return true;

		switch (op) {
			case "$ref":
				return await this.matchFieldRefCondition(record, fieldName, val, mode);
				break;

			case "$eq":
				return record[fieldName]===val;
				break;

			case "$ne":
				return record[fieldName]!=val;
				break;

			case "$gt":
				return record[fieldName]>val;
				break;

			case "$gte":
				return record[fieldName]>=val;
				break;

			case "$lt":
				return record[fieldName]<val;
				break;

			case "$lte":
				return record[fieldName]<=val;
				break;

			case "$includes":
				return String(record[fieldName]).toUpperCase().includes(val.toUpperCase());
				break;

			case "$in":
				return val.includes(record[fieldName]);
				break;

			case "$nin":
				return (!val.includes(record[fieldName]));
				break;

			default:
				throw new Error("Unknown op: "+op);
		}
	}

	async matchFieldConditions(record, fieldName, conds, mode) {
		for (let k in conds) {
			if (!await this.matchFieldCondition(record, fieldName, k, conds[k], mode))
				return false;
		}

		return true;
	}

	async matchLogical(record, op, whereConds, mode) {
		let subResults=[];

		for (let whereCond of whereConds) {
			let subWhere=new WhereClause({
				where: whereCond,
				tableName: this.tableName,
				alias: this.alias,
				qql: this.qql,
				//idGenerator: this.idGenerator
			});

			subResults.push(await subWhere.match(record,mode));
		}

		if (!subResults.length)
			throw new Error("No expressions in logical clause");

		let numTrue=0;
		for (let subResult of subResults)
			if (subResult)
				numTrue++;

		switch (op) {
			case "$or":
				return (numTrue>0);
				break;

			case "$and":
				return (numTrue==whereConds.length);
				break;

			default:
				throw new Error("op?");
		}
	}

	async match(record, mode) {
		if (!mode || !["strict","compatible"].includes(mode))
			throw new Error("Need conformance mode for match");

		if (!record)
			record={};

		for (let k in this.where) {
			if (["$or","$and"].includes(k)) {
				if (!await this.matchLogical(record,k,this.where[k],mode))
					return false;
			}

			else {
				if (!await this.matchFieldConditions(record,k,this.where[k],mode))
					return false;
			}
		}

		return true;
	}

	addAndWhereClause(otherWhereClause) {
		if (this.tableName!=otherWhereClause.tableName)
			throw new Error("Adding a where clause for a different table");

		if (this.qql!==otherWhereClause.qql)
			throw new Error("Different qql");

		if (!this.where.$and)
			this.where.$and=[];

		this.where.$and.push(otherWhereClause.where);
		this.process();
	}

	addOrWhereClause(otherWhereClause) {
		if (this.tableName!=otherWhereClause.tableName)
			throw new Error("Adding a where clause for a different table");

		if (this.qql!==otherWhereClause.qql)
			throw new Error("Different qql");

		if (!this.where.$or)
			this.where.$or=[];

		this.where.$or.push(otherWhereClause.where);
		this.process();
	}

	mapValuesFieldConditions(fn, conds) {
		let mappedConds={};

		for (let k in conds) {
			if (k=="$ref") {
				//console.log(conds[k]);
				mappedConds[k]=this.mapValuesWhere(fn,canonicalizeCondition(conds[k]));
			}

			else {
				mappedConds[k]=fn(conds[k]);
			}
		}

		return mappedConds;
	}

	mapValuesLogical(fn, logical) {
		let mappedLogical=[];

		for (let where of logical)
			mappedLogical.push(this.mapValuesWhere(fn,where));

		return mappedLogical;
	}

	mapValuesWhere(fn, where) {
		let mappedWhere={};

		for (let k in where) {
			if (["$or","$and"].includes(k)) {
				mappedWhere[k]=this.mapValuesLogical(fn,where[k]);
			}

			else {
				mappedWhere[k]=this.mapValuesFieldConditions(fn,where[k]);
			}
		}

		return mappedWhere;
	}

	mapValues(fn) {
		let mappedWhere=this.mapValuesWhere(fn,this.where);

		return new WhereClause({
			where: mappedWhere,
			tableName: this.tableName,
			qql: this.qql
		});
	}

	populateReversible(record) {
		for (let k in this.where) {
			if (!k.startsWith("$") && 
					!record.hasOwnProperty(k) &&
					this.where[k].hasOwnProperty("$eq")) {
				record[k]=this.where[k].$eq;
			}

			if (k=="$and") {
				for (let whereCond of this.where[k]) {
					let subWhere=new WhereClause({
						where: whereCond,
						tableName: this.tableName,
						alias: this.alias,
						qql: this.qql,
					});

					subWhere.populateReversible(record);
				}
			}
		}

		return record;
	}
}