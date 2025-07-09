import Table from "./Table.js";

export default class QqlAnalysis {
	constructor({qql}) {
		if (!qql.driver)
			throw new Error("Driver missing...");

		this.qql=qql;
		this.driver=this.qql.driver;
	}

	/*async getTableNames() {
		return await this.driver.getTableNames();
	}*/

	async load() {
		this.tables=[];
		for (let table of await this.qql.driver.describe()) {
			let describeRows=table.fields;//await this.driver.getDescribeRows(tableName);
			//console.log(describeRows);
			this.tables[table.name]=Table.fromDescribeRows(table.name,describeRows,this.qql);
		}
	}

	getMigrationQueries() {
		if (!this.tables)
			throw new Error("not loaded");

		let migrationQueries=[];
		for (let tableName in this.qql.tables) {
			//console.log("migrate: "+tableName);

			let targetTable=this.qql.tables[tableName];
			let currentTable=this.tables[tableName];
			migrationQueries.push(...targetTable.getMigrationQueries(currentTable))
		}

		return migrationQueries;
	}
}