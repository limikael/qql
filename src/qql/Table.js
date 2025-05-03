import Field from "./Field.js";
import {arrayOnlyUnique, assertAllowedKeys, arrayify, jsonClone, arrayDifference} from "../utils/js-util.js";
import {canonicalizeJoins, canonicalizeSort} from "../lib/qql-util.js";
import WhereClause from "../clause/WhereClause.js";
import Policy from "./Policy.js";

export default class Table {
	constructor({name, qql, fields, viewFrom, singleViewFrom, 
				access, readAccess, where, include, exclude,
				policies}) {
		//console.log("creating table: "+name+JSON.stringify(access)+JSON.stringify(readAccess));

		this.name=name;
		this.qql=qql;

		if (viewFrom || singleViewFrom) {
			if (access || readAccess || policies)
				throw new Error("views can not have security settings, view="+name+JSON.stringify(access)+JSON.stringify(readAccess));

			this.viewFrom=viewFrom||singleViewFrom;
			this.where=where||{};

			if (singleViewFrom)
				this.singleton=true;

			if (this.getTable().isView())
				throw new Error("Can't create a view from a view");

			if (!include)
				include=Object.keys(this.getTable().fields);

			if (!exclude)
				exclude=[];

			exclude=[...exclude,...Object.keys(this.where)];
			for (let ex of exclude) {
				if (!this.getTable().fields[ex])
					throw new Error("Unknown field to exclude: "+ex);
			}

			include=include.filter(item=>!exclude.includes(item));
			if (!include.includes(this.getTable().getPrimaryKeyFieldName()))
				include.push(this.getTable().getPrimaryKeyFieldName());

			this.fields={};
			for (let includeName of include)
				this.fields[includeName]=this.getTable().fields[includeName];
		}

		else {
			this.fields={};
			for (let fieldName in fields) {
				if (fields[fieldName] instanceof Field) {
					this.fields[fieldName]=fields[fieldName];
				}

				else if (fields[fieldName].type=="reference" ||
						fields[fieldName].reference) {
					this.fields[fieldName]=fields[fieldName];
				}

				else {
					this.fields[fieldName]=new Field({
						qql: this.qql,
						name: fieldName, 
						...fields[fieldName]
					});
				}
			}

			if (Object.keys(this.fields).filter(fid=>this.fields[fid].pk).length!=1)
				throw new Error("There must be exactly one primary key for table "+this.name);

			this.policies=[];
			if (policies) {
				for (let policyParams of policies) {
					this.policies.push(new Policy({
						...policyParams,
						tableName: this.name,
						qql: this.qql
					}));
				}
			}

	        if (!access && !readAccess && (this.policies.length==0)) {
	            access="admin";
	            readAccess="public";
	        }

	        access=arrayify(access);
	        readAccess=[...access,...arrayify(readAccess)];

	        if (access.length) {
				this.policies.push(new Policy({
					tableName: this.name,
					qql: this.qql,
					roles: access
				}));
	        }

			if (readAccess.length) {
				this.policies.push(new Policy({
					tableName: this.name,
					qql: this.qql,
					roles: readAccess,
					operations: ["read"]
				}));
			}
		}
	}

	getFieldByName(fieldName) {
		return this.fields[fieldName];
	}

	createReferences() {
		for (let fieldName in this.fields) {
			let fieldSpec=this.fields[fieldName];
			if (fieldSpec.type=="reference" || fieldSpec.reference) {
				//console.log("******* creating reference");
				let referenceTable=this.qql.tables[fieldSpec.reference];
				if (!referenceTable)
					throw new Error(
						"Referenced table doesn't exist: "+fieldSpec.reference+
						", referenced from: "+this.name
					);

				let pkField=referenceTable.getPrimaryKeyField();

				this.fields[fieldName]=new Field({
					qql: this.qql,
					name: fieldName,
					type: pkField.type,
					notnull: fieldSpec.notnull,
					default: fieldSpec.default
				});

				this.fields[fieldName].reference=referenceTable.name;
			}
		}
	}

	static fromDescribeRows(name, rows, qql) {
		let fields={};
		for (let row of rows) {
			let field=Field.fromDescribeRow(row,qql);
			fields[field.name]=field;
		}

		let table=new Table({name, fields, qql});

		return table;
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

	getPrimaryKeyFieldName() {
		for (let fieldName in this.fields)
			if (this.fields[fieldName].pk)
				return fieldName;
	}

	isView() {
		return !!this.viewFrom;
	}

	createDefaultSingleton(where) {
		if (!this.isView() || !this.singleton)
			throw new Error("Not singleton view");

		let item={};
		for (let fieldId in this.fields)
			item[fieldId]=jsonClone(this.fields[fieldId].default);

		for (let k in where)
			item[k]=where[k];

		return item;
	}

	getViewWhereClause() {
		if (!this.viewWhereClause) {
			this.viewWhereClause=new WhereClause({
				qql: this.qql,
				tableName: this.getTable().name,
				where: this.where
			})
		}

		return this.viewWhereClause;
	}

	createWhereClause(env, where, policies) {
		let w=new WhereClause({
			qql: this.qql,
			tableName: this.getTable().name,
			where: where
		});

		if (this.isView()) {
			let vw=this.getViewWhereClause().mapValues(v=>env.substituteVars(v));
			w.addAndWhereClause(vw);
		}

		for (let policy of policies)
			w.addOrWhereClause(policy.getWhereClause().mapValues(v=>env.substituteVars(v)))

		return w;
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
		assertAllowedKeys(query,["update","where","set","return"]);
		let policies=this.getApplicablePolicies(env,"update");

		let setParts=[];
		let setParams=[];
		for (let k in query.set) {
			if (!this.fields[k])
				throw new Error("No such field: "+k);

			let field=this.fields[k];
			setParts.push(this.qql.escapeId(k)+"=?");
			setParams.push(field.represent(query.set[k]));
		}

		let affectedId;
		if (query.return=="item") {
			let affectedRows=await this.queryManyFrom(env,{
				select: [this.getPrimaryKeyFieldName()],
				where: query.where,
				limit: 1
			});

			if (affectedRows.length)
				affectedId=affectedRows[0][this.getPrimaryKeyFieldName()];
		}

		let w=this.createWhereClause(env,query.where,policies);
		let s=
			"UPDATE "+
			this.qql.escapeId(this.getTable().name)+" "+
			w.getJoinClause()+
			" SET "+setParts.join(",")+" "+
			w.getWhereClause();

		let params=[...setParams,...w.getValues()];
		let changes=await this.qql.runQuery(s,params,"changes");
		if (this.singleton && !changes) {
			this.performQueryInsertInto(env,{
				set: {...query.where, ...query.set}
			});
		}

		if (!query.return)
			query.return="changes";

		switch (query.return) {
			case "changes":
				return changes;
				break;

			case "item":
				if (!affectedId)
					return;

				let items=await this.queryManyFrom(env, {
					where: {[this.getPrimaryKeyFieldName()]: affectedId},
					limit: 1
				});

				return items[0];
				break;

			default:
				throw new Error("Unknown return type: "+query.return);
		}
	}

	async queryDeleteFrom(env, query) {
		if (this.singleton)
			throw new Error("Can't delete from a singleton view");

		assertAllowedKeys(query,["deleteFrom","where","return"]);
		let policies=this.getApplicablePolicies(env,"delete");

		let affectedRow;
		if (query.return=="item") {
			let affectedRows=await this.queryManyFrom(env,{
				where: query.where,
				limit: 1
			});

			if (affectedRows.length)
				affectedRow=affectedRows[0];
		}

		let w=this.createWhereClause(env,query.where,policies);
		let s=
			"DELETE FROM "+
			this.qql.escapeId(this.getTable().name)+" "+
			w.getJoinClause()+" "+
			w.getWhereClause();

		let changes=await this.qql.runQuery(s,w.getValues(),"changes");

		if (!query.return)
			query.return="changes";

		switch (query.return) {
			case "changes":
				return changes;
				break;

			case "item":
				return affectedRow;
				break;
		}
	}

	async performQueryInsertInto(env, query) {
		assertAllowedKeys(query,["insertInto","set","return"]);

		let policies=this.getApplicablePolicies(env,"create");

		let fieldNames=[];
		let values=[];

		for (let k in query.set) {
			if (!this.fields[k])
				throw new Error("No such field: "+k);

			let field=this.fields[k];
			fieldNames.push(this.qql.escapeId(field.name));
			let representation=field.represent(query.set[k]);
			//values.push(this.qql.escapeValue(representation));
			values.push(representation);
		}

		if (this.isView()) {
			for (let k in this.where) {
				fieldNames.push(this.qql.escapeId(k));
				//values.push(this.qql.escapeValue(env.substituteVars(this.where[k])));
				values.push(env.substituteVars(this.where[k]));
			}
		}

		let s=
			"INSERT INTO "+
			this.qql.escapeId(this.getTable().name)+" ("+
			fieldNames.join(",")+") VALUES ("+
			new Array(values.length).fill("?").join(",")+
			")";

		let id=await this.qql.runQuery(s,values,"id");
		if (!query.return)
			query.return="id";

		switch (query.return) {
			case "id":
				return id;
				break;

			case "item":
				let items=await this.queryManyFrom(env,{
					where: {[this.getPrimaryKeyFieldName()]: id},
					limit: 1
				});
				return items[0];
				break;

			case "changes":
				return 1;
				break;

			default:
				throw new Error("Unknown return type: "+query.return);
		}
	}

	async queryInsertInto(env, query) {
		if (this.singleton)
			throw new Error("Can't insert into singleton view");

		return await this.performQueryInsertInto(env,query);
	}

	async queryCountFrom(env, query) {
		let policies=this.getApplicablePolicies(env,"read");
		if (this.singleton)
			return 1;

		let w=this.createWhereClause(env,query.where,policies);
		let s=
			"SELECT COUNT(*) AS count FROM "+
			this.qql.escapeId(this.getTable().name)+` `+
			w.getJoinClause()+" "+
			w.getWhereClause();

		let rows=await this.qql.runQuery(s,w.getValues(),"rows");
		return rows[0].count;
	}

	async queryManyFrom(env, query) {
		assertAllowedKeys(query,["select","unselect","manyFrom","limit","offset","where","include","sort"]);
		let policies=this.getApplicablePolicies(env,"read");

		let select=query.select;
		if (!select)
			select=Object.keys(this.fields);

		if (query.unselect)
			select=arrayDifference(select,query.unselect);

		for (let col of select)
			if (!this.fields[col])
				throw new Error("No such column: "+col);

		let w=this.createWhereClause(env,query.where,policies);

		let s=
			"SELECT "+select.map(this.qql.escapeId).join(",")+
			" FROM "+
			this.qql.escapeId(this.getTable().name)+` `+
			w.getJoinClause()+" "+
			w.getWhereClause();

		let sort=canonicalizeSort(query.sort);
		if (Object.keys(sort).length) {
			s+=" ORDER BY "+Object.keys(sort)
				.map(k=>this.qql.escapeId(k)+" "+sort[k])
				.join(",");
		}

		if (query.offset && !query.limit)
			throw new Error("Can't have offset without limit");

		if (query.limit) {
			s+=" LIMIT "+this.qql.escapeValue(query.limit);
			if (query.offset)
				s+=" OFFSET "+this.qql.escapeValue(query.offset);
		}

		//console.log(s);
		let rows=await this.qql.runQuery(s,w.getValues(),"rows");
		rows=rows.map(row=>{
			for (let fieldName in this.fields) {
				let field=this.fields[fieldName];
				if (row.hasOwnProperty(fieldName))
					row[fieldName]=field.present(row[fieldName]);
			}

			return row;
		});

		for (let includeName in query.include)
			await this.handleInclude(env,rows,includeName,query.include[includeName]);

		if (!rows.length && this.singleton) {
			return [
				this.createDefaultSingleton(query.where)
			];
		}

		return rows;
	}

	findReferencingField(referenceTableName) {
		let manyField;
		for (let fieldName in this.fields) {
			if (this.fields[fieldName].reference==referenceTableName) {
				if (manyField)
					throw new Error("Ambigous relation");

				manyField=this.fields[fieldName].name
			}
		}

		if (!manyField)
			throw new Error("No fitting relation found");

		return manyField;
	}

	async handleInclude(env, rows, fieldName, include) {
		let includeQuery={...include};

		if (includeQuery.manyFrom) {
			let refTable=this.qql.tables[includeQuery.manyFrom];
			if (!refTable)
				throw new Error("Included table not found: "+includeQuery.manyFrom);

			/*console.log("including: ",refTable.name);
			console.log(refTable.fields);*/

			let via=includeQuery.via;
			if (!via)
				via=refTable.findReferencingField(this.name);

			let thisPk=this.getPrimaryKeyField().name;
			let keys=arrayOnlyUnique(rows.map(row=>row[thisPk]));

			let rowByPk=Object.fromEntries(rows.map(row=>[row[thisPk],row]));

			delete includeQuery.via;
			let refRows=await this.qql.envQuery(env,{
				...includeQuery,
				manyFrom: refTable.name,
				where: {
					...includeQuery.where,
					[via]: keys
				}
			});

			for (let row of rows)
				row[fieldName]=[];

			for (let refRow of refRows) {
				let row=rowByPk[refRow[via]];
				row[fieldName].push(refRow);
			}
		}

		else if (includeQuery.oneFrom) {
			let refTable=this.qql.tables[includeQuery.oneFrom];
			if (!refTable)
				throw new Error("Included table not found: "+includeQuery.fromFrom);

			let via=includeQuery.via;
			if (!via)
				via=this.findReferencingField(refTable.name);

			let refPk=refTable.getPrimaryKeyField().name;
			let keys=arrayOnlyUnique(rows.map(row=>row[via]).filter(r=>!!r));

			delete includeQuery.oneFrom;
			delete includeQuery.via;

			let refRows=await this.qql.envQuery(env,{
				...includeQuery,
				manyFrom: refTable.name,
				where: {
					...includeQuery.where,
					[refPk]: keys
				}
			});

			//console.log(refRows);

			let refRowsByPk=Object.fromEntries(refRows.map(row=>[row[refPk],row]));
			for (let row of rows)
				row[fieldName]=refRowsByPk[row[via]];

			return rows;
		}

		else 
			throw new Error("include spec must have oneFrom or manyFrom");
	}

	async queryUpsert(env, query) {
		delete query.upsert;
		assertAllowedKeys(query,["set","where","return"]);

		if (!query.return)
			query.return="changes";

		if (query.return!="changes")
			throw new Error("Upsert only supports 'changes' as return type");

		if (!query.set || !Object.keys(query.set).length)
			throw new Error("Nothing to set!");

		let changes;
		changes=await this.queryUpdate(env,{...query, return: "changes"});
		if (changes>0)
			return changes;

		query.set={...query.set,...query.where};
		delete query.where;

		//console.log("********* doing insert via upsert");
		//console.log(query);
		changes=await this.queryInsertInto(env,{...query, return: "changes"});
		//console.log("c: "+changes);
		if (changes!=1)
			throw new Error("Expected 1 change");

		return 1;
	}

	getApplicablePolicies(env, operation) {
		if (env.isRoot())
			return [];

		let policies=[];
		for (let policy of this.getTable().policies)
			if (policy.match(operation,env.getRole()))
				policies.push(policy);

		if (!policies.length)
			throw new Error(operation+" on "+this.getTable().name+" not permitted with role "+env.getRole());

		return policies;
	}
}