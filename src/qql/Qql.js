import Table from "./Table.js";
import mysqlSqlstring from "sqlstring";
import QqlAnalysis from "./QqlAnalysis.js";
import {objectifyArgs, CallableClass} from "../utils/js-util.js";
import QqlEnv from "./QqlEnv.js";

export default class Qql extends CallableClass {
	constructor(...args) {
		//console.log("************ QQL CONSTRUCTOR");
		//console.log(driver);

		let {driver, tables}=objectifyArgs(args,["driver"]);

		super((q,r)=>this.query(q,r));

		this.rootEnv=new QqlEnv({root: true, qql: this});
		this.driver=driver;
		this.tables={};
		for (let tableName in tables)
			this.tables[tableName]=new Table({
				qql: this, 
				name: tableName,
				...tables[tableName]
			});

		for (let tableName in tables)
			this.tables[tableName].createReferences();
	}

	getTableByName=(tableName)=>{
		return this.tables[tableName];
	}

	env(env) {
		return new QqlEnv({qql: this, env});
	}

	escapeId=(id)=>{
		return this.driver.escapeId(id);
	}

	escapeValue=(value)=>{
		if (!["number","string","undefined","boolean"].includes(typeof value)
				&& value!==null)
			throw new Error("Not primitive type: "+value);

		return this.driver.escapeValue(value);
	}

	async runQueries(queryArray, returnType) {
		if (!queryArray.length)
			return [];

		if (!returnType)
			throw new Error("no return type");

		let results=await this.driver.queries(queryArray,returnType);
		return results;
	}

	async runQuery(query, params, returnType) {
		//console.log(query);

		if (!Array.isArray(params))
			throw new Error("params should be array!");

		if (!returnType)
			throw new Error("no return type");

		let res=await this.driver.query(query,params,returnType);
		return res;
	}

	async analyze() {
		let nameRows=await this.runQuery("SELECT name FROM sqlite_schema",[],"rows");
		nameRows=nameRows.filter(row=>!row.name.startsWith("_cf"));
		//console.log(nameRows);

		let infoQueries=[];
		for (let nameRow of nameRows)
			infoQueries.push(`PRAGMA table_info (\`${nameRow.name}\`)`)

		//console.log(infoQueries);

		let existingTables={};
		let infoRes=await this.runQueries(infoQueries,"rows");
		for (let i in nameRows) {
			let tableName=nameRows[i].name;
			//console.log(infoRes[i]);
			existingTables[tableName]=Table.fromDescribeRows(tableName,infoRes[i],this);
		}

		return new QqlAnalysis({tables: existingTables});
	}

	/*force, test, dryRun, risky*/
	async migrate(options={}) {
		let {dryRun, log}=options;
		if (!log)
			log=console.log;

		//log("Migrating schema...");

		let analysis=await this.analyze();

		//console.log(analysis.tables);

		let migrationQueries=[];
		for (let tableName in this.tables) {
			//console.log("Table: "+tableName);
			migrationQueries=[
				...migrationQueries,
				...this.tables[tableName].getMigrationQueries(analysis.tables[tableName])
			];
		}

		if (dryRun)
			log(migrationQueries);

		else {
			if (migrationQueries.length)
				log(migrationQueries.join("\n"));
			await this.runQueries(migrationQueries,"none");
		}
	}

	envQuery=async (env, query)=>{
		//console.log("q: ",query);
		if (query.oneFrom) {
			let {oneFrom, ...q}=query;
			let rows=await this.envQuery(env,{
				...q,
				manyFrom: query.oneFrom,
			});

			if (!rows.length)
				return null;

			return rows[0];
		}

		else if (query.manyFrom) {
			let table=this.tables[query.manyFrom];
			if (!table)
				throw new Error("No such table: "+query.manyFrom);

			return await table.queryManyFrom(env,query);
		}

		else if (query.countFrom) {
			let table=this.tables[query.countFrom];
			if (!table)
				throw new Error("No such table: "+query.countFrom);

			return await table.queryCountFrom(env,query);
		}

		else if (query.insertInto) {
			let table=this.tables[query.insertInto];
			if (!table)
				throw new Error("No such table: "+query.insertInto);

			return await table.queryInsertInto(env,query);
		}

		else if (query.update) {
			let table=this.tables[query.update];
			if (!table)
				throw new Error("No such table: "+query.update);

			return await table.queryUpdate(env,query);
		}

		else if (query.deleteFrom) {
			let table=this.tables[query.deleteFrom];
			if (!table)
				throw new Error("No such table: "+query.deleteFrom);

			return await table.queryDeleteFrom(env,query);
		}

		else if (query.upsert) {
			let table=this.tables[query.upsert];
			if (!table)
				throw new Error("No such table: "+query.upsert);

			return await table.queryUpsert(env,query);
		}

		else
			throw new Error("Query not understood");
	}

	query=async (query)=>{
		return this.envQuery(this.rootEnv,query);
	}
}

export function createQql(...args) {
	return new Qql(...args);
}