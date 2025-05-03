import WhereClause from "../clause/WhereClause.js";
import {arrayify} from "../utils/js-util.js";

export default class Policy {
	constructor({tableName, qql, operations, roles, fields, where}) {
		this.tableName=tableName;
		this.qql=qql;
		this.operations=operations;
		this.roles=arrayify(roles);
		this.fields=fields;
		this.where=where;

		//console.log("policy roles",this.roles);

		if (this.fields)
			throw new Error("field policy not impl");

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
}