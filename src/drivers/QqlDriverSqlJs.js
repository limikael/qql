import sqliteSqlstring from "sqlstring-sqlite";
import {objectifyRows} from "../lib/qql-util.js";

export default class QqlDriverSqlJs {
	constructor(sqlite) {
		this.sqlite=sqlite;
	}

	escapeId(id) {
		return sqliteSqlstring.escapeId(id);
	}

	escapeValue(value) {
		return sqliteSqlstring.escape(value);
	}

	async queries(queries, returnType) {
		let res=[];

		for (let query of queries)
			res.push(await this.query(query,[],returnType));

		return res;
	}

	query(query, params, returnType) {
		switch (returnType) {
			case "id":
				this.sqlite.run(query,params);
				let rowIdRes=this.sqlite.exec("SELECT last_insert_rowid() AS id");
				if (rowIdRes.length!=1)
					throw new Error("Expected exactly one id as return");

				let rowIdRows=objectifyRows(rowIdRes[0]);
				if (rowIdRows.length!=1)
					throw new Error("Expected exactly one id as return");

				return rowIdRows[0].id;
				break;

			case "changes":
				this.sqlite.run(query,params);
				let changesRes=this.sqlite.exec("SELECT changes() AS changes");
				if (changesRes.length!=1)
					throw new Error("Expected exactly one number as return");

				let changesRows=objectifyRows(changesRes[0]);
				if (changesRows.length!=1)
					throw new Error("Expected exactly one number as return");

				return changesRows[0].changes;
				break;

			case "rows":
				let rowRes=this.sqlite.exec(query,params);
				if (!rowRes.length)
					return [];

				if (rowRes.length!=1)
					throw new Error("Expected one result, q="+query+" res="+JSON.stringify(rowRes));

				return objectifyRows(rowRes[0]);
				break;

			case "none":
			case undefined:
				this.sqlite.run(query,params);
				break;

			default:
				throw new Error("Unknown query return type: "+returnType);
		}
	}
}
