import Table from "./Table.js";
import sqliteSqlstring from "sqlstring-sqlite";
import mysqlSqlstring from "sqlstring";
import QqlAnalysis from "./QqlAnalysis.js";
import {arrayOnlyUnique} from "./js-util.js";
import QqlEnv from "./QqlEnv.js";

export default class Qql {
	constructor({tables, driver, flavour}) {
		this.flavour=flavour;
		if (!this.flavour)
			this.flavour="sqlite";

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
			this.tables[tableName].createReferences(); //tables[tableName]);
	}

	getTableByName=(tableName)=>{
		return this.tables[tableName];
	}

	env(env) {
		return new QqlEnv({qql: this, env});
	}

	escapeId=(id)=>{
		switch (this.flavour) {
			case "sqlite":
				return sqliteSqlstring.escapeId(id);

			case "mysql":
				return mysqlSqlstring.escapeId(id);
		}
	}

	escapeValue=(value)=>{
		if (!["number","string","undefined","boolean"].includes(typeof value)
				&& value!==null)
			throw new Error("Not primitive type: "+value);

		switch (this.flavour) {
			case "sqlite":
				return sqliteSqlstring.escape(value);

			case "mysql":
				return mysqlSqlstring.escape(value);
		}
	}

	async runQueries(queryArray, returnType="rows") {
		if (!queryArray.length)
			return [];

		//console.log(queryArray);
		//console.log(this.driver);
		let results=await this.driver(queryArray,returnType);
		return results;
	}

	async runQuery(query, returnType="rows") {
		let results=await this.runQueries([query],returnType);
		return results[0];
	}

	async analyze() {
		let nameRows=await this.runQuery("SELECT name FROM sqlite_schema");
		nameRows=nameRows.filter(row=>!row.name.startsWith("_cf"));
		//console.log(nameRows);

		let infoQueries=[];
		for (let nameRow of nameRows)
			infoQueries.push(`PRAGMA table_info (\`${nameRow.name}\`)`)

		//console.log(infoQueries);

		let existingTables={};
		let infoRes=await this.runQueries(infoQueries);
		for (let i in nameRows) {
			let tableName=nameRows[i].name;
			//console.log(infoRes[i]);
			existingTables[tableName]=Table.fromDescribeRows(tableName,infoRes[i],this);
		}

		return new QqlAnalysis({tables: existingTables});
	}

	/*force, test, dryRun, risky*/
	async migrate(options={}) {
		console.log("Migrating schema...");
		let {dryRun}=options;

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
			console.log(migrationQueries);

		else {
			console.log(migrationQueries.join("\n"));
			await this.runQueries(migrationQueries);
		}
	}

	envQuery=async (env, query)=>{
		if (query.oneFrom) {
			let {oneFrom, ...q}=query;
			return (await this.envQuery(env,{
				...q,
				manyFrom: query.oneFrom,
			}))[0];
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

		else
			throw new Error("Query not understood");
	}

	query=async (query)=>{
		return this.envQuery(this.rootEnv,query);
	}
}