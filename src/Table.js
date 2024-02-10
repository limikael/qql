import Field from "./Field.js";
import Reference from "./Reference.js";
import {arrayOnlyUnique} from "./js-util.js";
import {canonicalizeJoins} from "./qql-util.js";

export default class Table {
	constructor({name, qql, fields, viewFrom}) {
		this.name=name;
		this.qql=qql;
		this.references={};

		if (viewFrom) {
			this.viewFrom=viewFrom;
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

					//console.log(reference.oneProp);

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
			return "";

		let exprs=[];
		for (let k in where) {
			let m=k.match(/^(\w+)([!=<>~%^]*)$/);
			if (!m)
				throw new Error("Syntax error in where: "+k);

			let name=m[1];
			let op=m[2];

			if (!this.fields[name])
				throw new Error("No such field: "+name);

			exprs.push(this.fields[name].createWhereExpression(op,where[k]));
		}

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

	async queryUpdate(query) {
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
			this.qql.escapeId(this.name)+" "+
			"SET "+sets.join(",")+" "+
			this.createWhereClause(query.where);

		//console.log(s);
		return await this.qql.runQuery(s);
	}

	async queryDeleteFrom(query) {
		let s=
			"DELETE FROM "+
			this.qql.escapeId(this.name)+" "+
			this.createWhereClause(query.where);

		return await this.qql.runQuery(s);
	}

	async queryInsertInto(query) {
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

		let s=
			"INSERT INTO "+
			this.qql.escapeId(this.name)+" ("+
			fieldNames.join(",")+") VALUES ("+
			values.join(",")+")";

		return await this.qql.runQuery(s);
	}

	async queryManyFrom(query) {
		let s=
			"SELECT * FROM "+
			this.qql.escapeId(query.manyFrom)+` `+
			this.createWhereClause(query.where);

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
			await this.handleJoin(rows,join);

		return rows;
	}

	async handleJoin(rows, joinSpec) {
		let join=joinSpec.join;
		let reference=this.references[join];

		if (!reference)
			throw new Error("Unknown join: "+JSON.stringify(join));

		if (reference.oneFrom==this && reference.oneProp==join) {
			let thisPk=this.getPrimaryKeyField().name;
			let keys=arrayOnlyUnique(rows.map(row=>row[thisPk]));

			let rowByPk=Object.fromEntries(rows.map(row=>[row[thisPk],row]));
			let refRows=await this.qql.query({
				...joinSpec,
				join: undefined,
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
				join: undefined,
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
}