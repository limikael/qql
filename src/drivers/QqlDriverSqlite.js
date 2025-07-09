import QqlDriverBase from "./QqlDriverBase.js";
import sqliteSqlstring from "sqlstring-sqlite";
import {sqliteDescribe} from "./sqlite-driver-common.js";

export default class QqlDriverSqlite extends QqlDriverBase {
	constructor(sqlite) {
		super({escapeFlavor: "sqlite"});
		this.sqlite=sqlite;
	}

	/*async getTableNames() {
		let nameRows=await this.query("SELECT name FROM sqlite_schema",[],"rows");
		nameRows=nameRows.filter(row=>!row.name.startsWith("_cf"));

		return nameRows.map(row=>row.name);
	}

	async getDescribeRows(tableName) {
		return await sqliteGetDescribeRows(this,tableName);
	}*/

	async describe() {
		return await sqliteDescribe(this);
	}

	query(query, params, returnType) {
		//console.log("q: ",query,params);

		return new Promise((resolve, reject)=>{
			function cb(err, rows) {
				if (err) {
					reject(err);
					return;
				}

				switch (returnType) {
					case "rows":
						resolve(rows);
						break;

					case "id":
						resolve(this.lastID);
						break;

					case "changes":
						resolve(this.changes);
						break;

					case undefined:
					case "none":
						resolve();
						break;

					default:
						reject(new Error("Unknown return type: "+returnType));
						break;
				}
			}

			if (returnType=="rows")
				this.sqlite.all(query,params,cb);

			else
				this.sqlite.run(query,params,cb);
		});
	}
}
