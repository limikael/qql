import Field from "./Field.js";
import Reference from "./Reference.js";
import {arrayOnlyUnique, assertAllowedKeys, arrayify} from "./js-util.js";
import {canonicalizeJoins} from "./qql-util.js";

export default class Table {
	constructor({name, qql, fields, viewFrom, access, readAccess, where, include, exclude}) {
		//console.log("role when creating table: "+qql.role);

		this.name=name;
		this.qql=qql;
		this.references={};

        if (!access && !readAccess) {
            access="admin";
            readAccess="public";
        }

        this.access=arrayify(access);
        this.readAccess=[...this.access,...arrayify(readAccess)];

		if (viewFrom) {
			this.viewFrom=viewFrom;
			this.where=where||{};

			if (this.getTable().isView())
				throw new Error("Can't create a view from a view");

			for (let k in this.where) {
				if (!this.getTable().fields[k])
					throw new Error("Unknown field in where clause for view: "+k);

				let field=this.getTable().fields[k];
				if (!["text","integer","boolean"].includes(field.type))
					throw new Error("Can not use type "+field.type+" in where clause for view: "+field.name);
			}

			if (!include)
				include=Object.keys(this.getTable().fields);

			if (!exclude)
				exclude=[];

			exclude=[...exclude,...Object.keys(this.where)];
			include=include.filter(item=>!exclude.includes(item));

			this.fields={};
			for (let includeName of include)
				this.fields[includeName]=this.getTable().fields[includeName];
		}

		else {
			this.fields={};
			for (let fieldName in fields) {
				let fieldSpec=fields[fieldName];

				if (fieldSpec.type=="reference") {
					let referenceTable=this.qql.tables[fieldSpec.reference];
					let pkField=referenceTable.getPrimaryKeyField();
					let name=fieldName+"_"+pkField.name;

					let reference=new Reference({
						oneFrom: referenceTable,
						oneProp: fieldSpec.refprop,
						manyFrom: this,
						manyProp: fieldName,
						manyField: name
					});

					if (this.references[reference.manyProp] ||
							referenceTable.references[reference.oneProp]) {
						throw new Error("Ambigous reference: "+JSON.stringify(fieldSpec));
					}

					this.references[reference.manyProp]=reference;
					referenceTable.references[reference.oneProp]=reference;

					this.fields[name]=new Field({
						qql: this.qql,
						name: name,
						type: pkField.type,
						notnull: fieldSpec.notnull,
						default: fieldSpec.default
					});
				}

				else {
					this.fields[fieldName]=new Field({
						qql: this.qql,
						name: fieldName, 
						...fields[fieldName]
					});
				}
			}
		}
	}

	getTable() {
		if (!this.isView())
			return this;

		return this.qql.tables[this.viewFrom];
	}

	getPrimaryKeyField() {
		for (let fieldName in this.fields)
			if (this.fields[fieldName].pk)
				return this.fields[fieldName];
	}

	isView() {
		return !!this.viewFrom;
	}

	createWhereClause(where) {
		if (!where)
			where={};

		let exprs=[];
		for (let k in where) {
			let m=k.match(/^(\w+)([!=<>~%^]*)$/);
			if (!m)
				throw new Error("Syntax error in where: "+k);

			let name=m[1];
			let op=m[2];

			if (!this.fields[name])
				throw new Error("No such field: "+name);

			exprs.push(this.fields[name].createWhereExpression(where[k],op));
		}

		if (this.isView()) {
			let fields=this.getTable().fields;
			for (let k in this.where)
				exprs.push(fields[k].createWhereExpression(this.where[k]));
		}

		if (!exprs.length)
			return "";

		return "WHERE "+exprs.join(" AND ");
	}

	static fromDescribeRows(name, rows) {
		let table=new Table({name, fields:{}});
		for (let row of rows) {
			let field=Field.fromDescribeRow(row);
			table.fields[field.name]=field;
		}

		return table;
	}

	isCurrent(existingTable) {
		if (Object.keys(this.fields).length
				!=Object.keys(existingTable.fields).length)
			return false;

		for (let fieldName in this.fields)
			if (!this.fields[fieldName].defEquals(existingTable.fields[fieldName]))
				return false;

		return true;
	}

	getMigrationQueries(existingTable, options={}) {
		if (this.isView())
			return [];

		let {force, test}=options;

		// If it doesn't exist, create.
		if (!existingTable)
			return [this.getCreateTableQuery()];

		// If up to date, don't do anything.
		if (this.isCurrent(existingTable) && !force)
			return [];

		// Modify.
		let queries=[];

		queries.push(this.getCreateTableQuery("_new"));

		let existingFieldNames=Object.keys(existingTable.fields);
		let copyFields=Object.keys(this.fields)
			.filter(fieldName=>existingFieldNames.includes(fieldName));

		if (copyFields.length) {
			let copyS=copyFields.map(s=>"`"+s+"`").join(",");
			let sq=`INSERT INTO \`${this.name+"_new"}\` (${copyS}) SELECT ${copyS} FROM \`${this.name}\``;
			queries.push(sq);
		}

		if (test) {
			queries.push(`DROP TABLE \`${this.name+"_new"}\``);
		}

		else {
			queries.push(`ALTER TABLE \`${this.name}\` RENAME TO \`${this.name+"_old"}\``);
			queries.push(`ALTER TABLE \`${this.name+"_new"}\` RENAME TO \`${this.name}\``);
			queries.push(`DROP TABLE \`${this.name+"_old"}\``);
		}

		return queries;
	}

	getCreateTableQuery(suffix="") {
		let parts=[];
		for (let fieldName in this.fields) {
			parts.push(this.fields[fieldName].getCreateSql());
		}

		return `CREATE TABLE \`${this.name+suffix}\` (${parts.join(",")})`;
	}

	async queryUpdate(env, query) {
		assertAllowedKeys(query,["update","where","set"]);
		this.assertWriteAccess(env);

		let sets=[];
		for (let k in query.set) {
			if (!this.fields[k])
				throw new Error("No such field: "+k);

			let field=this.fields[k];

			sets.push(
				this.qql.escapeId(k)+"="+
				this.qql.escapeValue(field.represent(query.set[k]))
			);
		}

		let s=
			"UPDATE "+
			this.qql.escapeId(this.getTable().name)+" "+
			"SET "+sets.join(",")+" "+
			this.createWhereClause(query.where);

		return await this.qql.runQuery(s,"none");
	}

	async queryDeleteFrom(env, query) {
		assertAllowedKeys(query,["deleteFrom","where"]);
		this.assertWriteAccess(env);

		let s=
			"DELETE FROM "+
			this.qql.escapeId(this.getTable().name)+" "+
			this.createWhereClause(query.where);

		return await this.qql.runQuery(s,"none");
	}

	async queryInsertInto(env, query) {
		assertAllowedKeys(query,["insertInto","set"]);
		this.assertWriteAccess(env);

		let fieldNames=[];
		let values=[];

		for (let k in query.set) {
			if (!this.fields[k])
				throw new Error("No such field: "+k);

			let field=this.fields[k];
			fieldNames.push(this.qql.escapeId(field.name));
			let representation=field.represent(query.set[k]);
			values.push(this.qql.escapeValue(representation));
		}

		if (this.isView()) {
			for (let k in this.where) {
				fieldNames.push(this.qql.escapeId(k));
				values.push(this.qql.escapeValue(this.where[k]));
			}
		}

		let s=
			"INSERT INTO "+
			this.qql.escapeId(this.getTable().name)+" ("+
			fieldNames.join(",")+") VALUES ("+
			values.join(",")+")";

		return await this.qql.runQuery(s,"id");
	}

	async queryManyFrom(env, query) {
		assertAllowedKeys(query,["select","manyFrom","limit","offset","where","join"]);
		this.assertReadAccess(env);

		let select=query.select;
		if (!select)
			select=Object.keys(this.fields);

		for (let col of select)
			if (!this.fields[col])
				throw new Error("No such column: "+col);

		let s=
			"SELECT "+select.map(this.qql.escapeId).join(",")+
			" FROM "+
			this.qql.escapeId(this.getTable().name)+` `+
			this.createWhereClause(query.where);

		if (query.offset && !query.limit)
			throw new Error("Can't have offset without limit");

		if (query.limit) {
			s+=" LIMIT "+this.qql.escapeValue(query.limit);
			if (query.offset)
				s+=" OFFSET "+this.qql.escapeValue(query.offset);
		}

		let rows=await this.qql.runQuery(s);
		rows=rows.map(row=>{
			for (let fieldName in this.fields) {
				let field=this.fields[fieldName];
				if (row.hasOwnProperty(fieldName))
					row[fieldName]=field.present(row[fieldName]);
			}

			return row;
		});

		for (let join of canonicalizeJoins(query.join))
			await this.handleJoin(env,rows,join);

		return rows;
	}

	async handleJoin(env, rows, joinSpecArg) {
		let {join, ...joinSpec}=joinSpecArg;
		let reference=this.references[join];

		if (!reference)
			throw new Error("Unknown join: "+JSON.stringify(join));

		if (reference.oneFrom==this && reference.oneProp==join) {
			let thisPk=this.getPrimaryKeyField().name;
			let keys=arrayOnlyUnique(rows.map(row=>row[thisPk]));

			let rowByPk=Object.fromEntries(rows.map(row=>[row[thisPk],row]));
			let refRows=await this.qql.envQuery(env,{
				...joinSpec,
				manyFrom: reference.manyFrom.name,
				where: {
					...joinSpec.where,
					[reference.manyField]: keys
				}
			});

			for (let row of rows)
				row[reference.oneProp]=[];

			for (let refRow of refRows) {
				let row=rowByPk[refRow[reference.manyField]];
				row[reference.oneProp].push(refRow);
			}
		}

		else if (reference.manyFrom==this && reference.manyProp==join) {
			let refPk=reference.oneFrom.getPrimaryKeyField().name;
			let keys=arrayOnlyUnique(rows.map(row=>row[reference.manyField]).filter(r=>!!r));

			let refRows=await this.qql.query({
				...joinSpec,
				manyFrom: reference.oneFrom.name,
				where: {
					...joinSpec.where,
					[refPk]: keys
				}
			});

			let refRowsByPk=Object.fromEntries(refRows.map(row=>[row[refPk],row]));
			for (let row of rows)
				row[reference.manyProp]=refRowsByPk[row[reference.manyField]];

			return rows;
		}

		else
			throw new Error("Unable to join: "+JSON.stringify(join));
	}

	assertReadAccess(env) {
		if (env.isRoot())
			return;

        if (!this.readAccess.includes(env.getRole()))
        	throw new Error("Not allowed to read from: "+this.name+" with role "+env.getRole());
	}

	assertWriteAccess(env) {
		if (env.isRoot())
			return;

        if (!this.access.includes(env.getRole()))
        	throw new Error("Not allowed to write to: "+this.name+" with role "+env.getRole());
	}
}