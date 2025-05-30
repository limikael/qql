import Field from "./Field.js";
import {assertAllowedKeys, arrayify, jsonClone, 
		arrayUnique, arrayDifference, arrayIntersection,
		DeclaredError, arrayChunkify} from "../utils/js-util.js";
import {canonicalizeJoins, canonicalizeSort} from "../lib/qql-util.js";
import WhereClause from "../clause/WhereClause.js";
import Policy from "./Policy.js";

export default class Table {
	constructor({name, qql, fields, viewFrom, singleViewFrom, 
				where, include, exclude, policies, ...extra}) {
		//console.log("creating table: "+name+JSON.stringify(access)+JSON.stringify(readAccess));

		if (Object.keys(extra).length)
			throw new Error("Unknown table/view config options: "+String(Object.keys(extra)));

		this.name=name;
		this.qql=qql;

		if (viewFrom || singleViewFrom) {
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
		}

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
	}

	getFieldNames({include, exclude}={}) {
		let fieldNames=include;
		if (!fieldNames)
			fieldNames=Object.keys(this.fields);

		if (exclude)
			fieldNames=arrayDifference(fieldNames,exclude);

		for (let col of fieldNames)
			if (!this.fields[col])
				throw new Error("No such column: "+col);

		return fieldNames;
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
			let vw=this.getViewWhereClause().mapValues(env.substituteVars);
			w.addAndWhereClause(vw);
		}

		if (policies) {
			if (!Array.isArray(policies))
				throw new Error("policies is not an array");

			for (let policy of policies) {
				let pw=policy.getWhereClause().mapValues(env.substituteVars);
				w.addOrWhereClause(pw)
			}
		}

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

	async getIdsByWhere(w) {
		let	s="SELECT "+
				this.escapedCanonicalFieldName(this.getPrimaryKeyFieldName())+" AS id "+
				"FROM "+this.qql.escapeId(this.getTable().name)+" "+
				w.getJoinClause()+
				w.getWhereClause();

		let rows=await this.qql.runQuery(s,w.getValues(),"rows");
		let res=rows.map(r=>r.id);

		//console.log(rows);
		//console.log(res);
		//console.log(s);

		return res;
	}

	async queryUpdate(env, query) {
		if (this.singleton)
			throw new Error("singleton update not implemented for now");

		assertAllowedKeys(query,["update","where","set","return"]);

		let policies=this.assertApplicablePolicies(env,"update",Object.keys(query.set));

		let checkW=this.createWhereClause(env,null,policies);
		if (!await checkW.match(query.set,"compatible"))
			throw new DeclaredError("Data for update not allowed",{status: 403});

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
		let changes;

		if (w.getJoins().length) {
			let ids=await this.getIdsByWhere(w);
			let s="UPDATE "+
				this.qql.escapeId(this.getTable().name)+
				" SET "+setParts.join(",")+
				" WHERE "+this.qql.escapeId(this.getPrimaryKeyFieldName())+
				" IN ("+Array(ids.length).fill("?").join(",")+")";

			//console.log(s);

			let params=[...setParams,...ids];
			changes=await this.qql.runQuery(s,params,"changes");
		}

		else {
			let s="UPDATE "+
				this.qql.escapeId(this.getTable().name)+" "+
				w.getJoinClause()+
				" SET "+setParts.join(",")+" "+
				w.getWhereClause();

			let params=[...setParams,...w.getValues()];
			changes=await this.qql.runQuery(s,params,"changes");
		}

		//console.log(s);

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
		let policies=this.assertApplicablePolicies(env,"delete");

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
		let changes;

		if (w.getJoins().length) {
			let ids=await this.getIdsByWhere(w);
			let s="DELETE FROM "+
				this.qql.escapeId(this.getTable().name)+" "+
				" WHERE "+this.qql.escapeId(this.getPrimaryKeyFieldName())+
				" IN ("+Array(ids.length).fill("?").join(",")+")";

			//console.log(s);

			let params=ids;
			changes=await this.qql.runQuery(s,params,"changes");
		}

		else {
			let s=
				"DELETE FROM "+
				this.qql.escapeId(this.getTable().name)+" "+
				w.getJoinClause()+" "+
				w.getWhereClause();

			changes=await this.qql.runQuery(s,w.getValues(),"changes");
		}

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

	async performQueryInsertIntoValues(env, query) {
		assertAllowedKeys(query,["insertInto","values","return","batchSize"]);
		if (env.isChecked())
			throw new Error("Can't insert values into checked env");

		if (query.hasOwnProperty("set"))
			throw new Error("Can't insert values with both values and set");

		if (this.isView())
			throw new Error("Can't insert values into view");

		if (query.return)
			throw new Error("Insert with values can't return anything");

		let values=query.values;
		if (!Array.isArray(values))
			throw new Error("Expected values to be an array of objects");

		if (!values.length)
			return;

		let columns=[];
		for (let value of values)
			for (let k in value)
				if (!columns.includes(k))
					columns.push(k);

		let valuesChunks=[values];
		if (query.batchSize)
			valuesChunks=arrayChunkify(values,query.batchSize);

		// chunkify here...

		for (let valuesChunk of valuesChunks) {
			let queryValues=[];
			let queryParts=[];
			for (let value of valuesChunk) {
				queryParts.push("("+Array(columns.length).fill("?").join(",")+")");
				for (let col of columns) {
					if (value.hasOwnProperty(col)) {
						let field=this.getTable().fields[col];
						queryValues.push(field.represent(value[col]))
					}

					else {
						queryValues.push(null);
					}
				}
			}

			let s=
				"INSERT INTO "+
				this.qql.escapeId(this.getTable().name)+" ("+
				columns.map(c=>this.qql.escapeId(c)).join(",")+") VALUES "+
				queryParts.join(",");

			await this.qql.runQuery(s,queryValues,"none");
		}
	}

	async performQueryInsertInto(env, query) {
		assertAllowedKeys(query,["insertInto","set","values","return","batchSize"]);

		if (query.hasOwnProperty("values")) {
			return this.performQueryInsertIntoValues(env,query);
		}

		let set=query.set;
		if (!set || !Object.keys(set).length)
			throw new Error("Can't insert empty set");

		let policies=this.assertApplicablePolicies(env,"create",Object.keys(set));

		let unknown=arrayDifference(Object.keys(set),this.getFieldNames());
		if (unknown.length)
			throw new Error("Unknown fields for insert: "+String(unknown));

		/*if (policy)
			policy.assertFieldsWritable(Object.keys(set));*/

		let w=this.createWhereClause(env,null,policies);
		w.populateReversible(set);

		if (!await w.match(set,"strict"))
			throw new DeclaredError("Inserted data not allowed",{status: 403});

		let fieldNames=[];
		let values=[];

		for (let k in set) {
			let field=this.getTable().fields[k];
			fieldNames.push(this.qql.escapeId(field.name));
			let representation=field.represent(set[k]);
			values.push(representation);
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
		if (this.singleton)
			return 1;

		let policies=this.assertApplicablePolicies(env,"read",[]);
		let w=this.createWhereClause(env,query.where,policies);
		let s=
			"SELECT COUNT(*) AS count FROM "+
			this.qql.escapeId(this.getTable().name)+` `+
			w.getJoinClause()+" "+
			w.getWhereClause();

		let rows=await this.qql.runQuery(s,w.getValues(),"rows");
		return rows[0].count;
	}

	escapedCanonicalFieldName(fn) {
		return this.qql.escapeId(this.getTable().name)+"."+this.qql.escapeId(fn);
	}

	async queryOneFrom(env, query) {
		let includePolicyInfo=query.includePolicyInfo;

		delete query.oneFrom;
		delete query.includePolicyInfo;

		let select;
		if (query.selectAllReadable) {
			let policies=this.getApplicablePolicies(env,"read",[]);
			let w=this.createWhereClause(env,query.where,policies);
			let s=
				"SELECT * "+
				" FROM "+
				this.qql.escapeId(this.getTable().name)+` `+
				w.getJoinClause()+" "+
				w.getWhereClause()+" "+
				"LIMIT 1";
			let rows=await this.qql.runQuery(s,w.getValues(),"rows");
			if (!rows.length)
				return;

			let row=this.presentRow(rows[0]);
			select=[]; 

			//console.log("actual row",row);

			for (let policy of policies) {
				//console.log(policy.where);
				let pw=policy.getWhereClause().mapValues(env.substituteVars);
				if (await pw.match(row,"strict"))
					select.push(...policy.getFieldNames());
			}

			select=arrayUnique(select);
			if (!select.length)
				throw new Error("No readable fields???");
		}

		delete query.selectAllReadable;

		let rows=await this.queryManyFrom(env, {select, ...query});
		if (!rows.length)
			return null;

		let row=rows[0];
		if (includePolicyInfo) {
			if (!env.isChecked())
				throw new Error("Can't include policies, not checked env.");

			let policyInfo={read: false, update: false, delete: false, readFields: [], updateFields: []};
			for (let policy of this.policies) {
				if (policy.roles.includes(env.getRole())) {
					let pw=policy.getWhereClause().mapValues(env.substituteVars);
					if (await pw.match(row,"strict")) {
						for (let op of policy.operations) {
							policyInfo[op]=true;
							if (["read","update"].includes(op))
								policyInfo[op+"Fields"].push(...policy.getFieldNames());
						}
					}
				}
			}

			policyInfo.readFields=arrayUnique(policyInfo.readFields);
			policyInfo.updateFields=arrayUnique(policyInfo.updateFields);

			row.$policyInfo=policyInfo;
		}

		return row;
	}

	//need to fix default selected fields here...

	async queryManyFrom(env, query) {
		assertAllowedKeys(query,["select","unselect","manyFrom","limit","offset","where","include","sort"]);

		let select=query.select;
		if (env.isChecked() && !select) {
			let readPolicies=this.getApplicablePolicies(env,"read",[]);
			select=Policy.getNarrowestFieldSet(readPolicies);
		}

		select=this.getFieldNames({include: select, exclude: query.unselect});
		let policies=this.assertApplicablePolicies(env,"read",select);

		//console.log(query.where);
		let w=this.createWhereClause(env,query.where,policies);

		let s=
			"SELECT "+select.map(f=>this.escapedCanonicalFieldName(f)).join(",")+
			" FROM "+
			this.qql.escapeId(this.getTable().name)+` `+
			w.getJoinClause()+" "+
			w.getWhereClause();

		let sort=canonicalizeSort(query.sort);
		if (Object.keys(sort).length) {
			s+=" ORDER BY "+Object.keys(sort)
				.map(k=>this.escapedCanonicalFieldName(k)+" "+sort[k])
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
		rows=rows.map(row=>this.presentRow(row));

		for (let includeName in query.include)
			await this.handleInclude(env,rows,includeName,query.include[includeName]);

		if (!rows.length && this.singleton) {
			return [
				this.createDefaultSingleton(query.where)
			];
		}

		return rows;
	}

	presentRow(row) {
		for (let fieldName in row) {
			let field=this.fields[fieldName];
			if (field)
				row[fieldName]=field.present(row[fieldName]);
		}

		return row;
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
			let keys=arrayUnique(rows.map(row=>{
				if (!row.hasOwnProperty(thisPk))
					throw new Error("Need to select the primary key for include");

				return row[thisPk]
			}));

			let rowByPk=Object.fromEntries(rows.map(row=>[row[thisPk],row]));

			if (includeQuery.select && !includeQuery.select.includes(via))
				throw new Error("Need to select the via column for include");

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
			let keys=arrayUnique(rows.map(row=>row[via]).filter(r=>!!r));

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

	assertApplicablePolicies(env, operation, fieldNames) {
		if (env.isRoot())
			return;

		let policies=this.getApplicablePolicies(env, operation, fieldNames);
		if (!policies.length)
			throw new Error(operation+" on "+this.name+" not permitted with role "+env.getRole());

		return policies;
	}

	getApplicablePolicies(env, operation, fieldNames) {
		if (env.isRoot())
			return;

		let candPolicies=this.policies;
		if (!candPolicies.length)
			candPolicies=this.getTable().policies;

		let policies=candPolicies.filter(p=>p.match(operation,env.getRole(),fieldNames));

		return policies;
	}
}