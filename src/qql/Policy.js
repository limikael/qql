import WhereClause from "../clause/WhereClause.js";
import {arrayify, arrayDifference, arrayIntersection} from "../utils/js-util.js";

export default class Policy {
	constructor({tableName, qql, operations, roles, where,
			include, exclude, readonly, writable, ...extra}) {
		if (Object.keys(extra).length)
			throw new Error("Unknown policy params: "+String(Object.keys(extra)));

		this.tableName=tableName;
		this.qql=qql;
		this.operations=operations;
		this.roles=arrayify(roles);
		this.where=where;

		this.include=arrayify(include);
		this.exclude=arrayify(exclude);
		this.readonly=arrayify(readonly);
		this.writable=arrayify(writable);

		//console.log("policy roles",this.roles);

		/*if (this.fields)
			throw new Error("field policy not impl");*/

		if (!this.roles.length)
			throw new Error("roles required for policy");

		if (!this.operations || this.operations.length==0)
			this.operations=["create","read","update","delete"];
	}

	match(operation, role) {
		if (!this.operations.includes(operation))
			return false;

		if (!this.roles.includes(role))
			return false;

		return true;
	}

	getWhereClause() {
		if (!this.whereClause)
			this.whereClause=new WhereClause({
				qql: this.qql,
				tableName: this.tableName,
				where: this.where
			});

		return this.whereClause; 
	}

	getReadFields() {
		let table=this.qql.getTableByName(this.tableName);

		let fields=this.include;
		if (!fields.length)
			fields=Object.keys(table.fields);

		fields=arrayDifference(fields,this.exclude);

		return fields;
	}

	getWriteFields() {
		let fields=this.getReadFields();

		if (this.readonly.length)
			fields=arrayDifference(fields,this.readonly);

		if (this.writable.length)
			fields=arrayIntersection(fields,this.writable);

		return fields;
	}
}