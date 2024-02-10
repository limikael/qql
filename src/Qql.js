import Table from "./Table.js";
import sqliteSqlstring from "sqlstring-sqlite";
import mysqlSqlstring from "sqlstring";
import QqlAnalysis from "./QqlAnalysis.js";
import {arrayOnlyUnique} from "./js-util.js";

export default class Qql {
	constructor({tables, driver, flavour}) {
		this.flavour=flavour;
		if (!this.flavour)
			this.flavour="sqlite";

		this.driver=driver;
		this.tables={};
		for (let tableName in tables)
			this.tables[tableName]=new Table({
				qql: this, 
				name: tableName, 
				...tables[tableName]
			});
	}

	escapeId(id) {
		switch (this.flavour) {
			case "sqlite":
				return sqliteSqlstring.escapeId(id);

			case "mysql":
				return mysqlSqlstring.escapeId(id);
		}
	}

	escapeValue(value) {
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

	async runQueries(queryArray) {
		//console.log(queryArray);
		let results=await this.driver(queryArray);
		return results;
	}

	async runQuery(query) {
		let results=await this.runQueries([query]);
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
			existingTables[tableName]=Table.fromDescribeRows(tableName,infoRes[i]);
		}

		return new QqlAnalysis({tables: existingTables});
	}

	/*force, test, dryRun, risky*/
	async migrate() {
		let analysis=await this.analyze();

		//console.log(analysis.tables);

		let migrationQueries=[];
		for (let tableName in this.tables)
			migrationQueries=[
				...migrationQueries,
				...this.tables[tableName].getMigrationQueries(analysis.tables[tableName])
			];

		//console.log(migrationQueries);
		await this.runQueries(migrationQueries);
	}

	query=async (query)=>{
		if (query.oneFrom) {
			return (await this.query({
				...query,
				oneFrom: null,
				manyFrom: query.oneFrom,
			}))[0];
		}

		else if (query.manyFrom) {
			let table=this.tables[query.manyFrom];
			if (!table)
				throw new Error("No such table: "+query.manyFrom);

			return await table.queryManyFrom(query);
		}

		else if (query.insertInto) {
			let table=this.tables[query.insertInto];
			if (!table)
				throw new Error("No such table: "+query.insertInto);

			return await table.queryInsertInto(query);
		}

		else if (query.update) {
			let table=this.tables[query.update];
			if (!table)
				throw new Error("No such table: "+query.update);

			return await table.queryUpdate(query);
		}

		else if (query.deleteFrom) {
			let table=this.tables[query.deleteFrom];
			if (!table)
				throw new Error("No such table: "+query.deleteFrom);

			return await table.queryDeleteFrom(query);
		}

		else
			throw new Error("Query not understood");
	}
}