import WhereClause from "../clause/WhereClause.js";
import {arrayify, arrayDifference, arrayIntersection} from "../utils/js-util.js";

export default class Policy {
	constructor({tableName, qql, operations, roles, where,
			include, exclude, ...extra}) {
		if (Object.keys(extra).length)
			throw new Error("Unknown policy params: "+String(Object.keys(extra)));

		this.tableName=tableName;
		this.qql=qql;
		this.operations=arrayify(operations);
		this.roles=arrayify(roles);
		this.where=where;

		this.include=arrayify(include);
		this.exclude=arrayify(exclude);

		if (!this.roles.length)
			throw new Error("roles required for policy");

		if (!this.operations || this.operations.length==0)
			this.operations=["create","read","update","delete"];

		let extraOps=arrayDifference(this.operations,["create","read","update","delete"]);
		if (extraOps.length)
			throw new Error("Unknown policy operations: "+String(extraOps));
	}

	match(operation, role, fieldNames) {
		if (!this.operations.includes(operation))
			return false;

		if (!this.roles.includes(role))
			return false;

		if (operation!="delete") {
			if (!fieldNames)
				fieldNames=this.qql.getTableByName(this.tableName).getFieldNames();

			if (arrayDifference(fieldNames,this.getFieldNames()).length)
				return false;
		}

		//console.log("matching role: ",role," fieldNames ",fieldNames," this fieldNames ",this.getFieldNames());

		return true;
	}

	getWhereClause() {
		if (!this.whereClause)
			this.whereClause=new WhereClause({
				qql: this.qql,
				tableName: this.qql.getTableByName(this.tableName).getTable().name,
				where: this.where
			});

		return this.whereClause; 
	}

	getFieldNames() {
		let table=this.qql.getTableByName(this.tableName);

		let fields=this.include;
		if (!fields.length)
			fields=Object.keys(table.fields);

		fields=arrayDifference(fields,this.exclude);

		return fields;
	}

	static getNarrowestFieldSet(policies) {
		let fieldNames;

		for (let policy of policies) {
			if (fieldNames)
				fieldNames=arrayIntersection(fieldNames,policy.getFieldNames());

			else
				fieldNames=policy.getFieldNames();
		}

		return fieldNames;
	}
}