import Qql from "./Qql.js";
import {objectifyArgs} from "./js-util.js";
import {objectifyRows} from "./qql-util.js";

export function qqlDriverSqlJs(sqlite) {
	function singleQuery(query, returnType) {
		if (!returnType)
			returnType="none";

		switch (returnType) {
			case "id":
				sqlite.run(query);
				let rowIdRes=sqlite.exec("SELECT last_insert_rowid() AS id");
				if (rowIdRes.length!=1)
					throw new Error("Expected exactly one id as return");

				let rowIdRows=objectifyRows(rowIdRes[0]);
				if (rowIdRows.length!=1)
					throw new Error("Expected exactly one id as return");

				return rowIdRows[0].id;
				break;

			case "changes":
				sqlite.run(query);
				let changesRes=sqlite.exec("SELECT changes() AS changes");
				if (changesRes.length!=1)
					throw new Error("Expected exactly one number as return");

				let changesRows=objectifyRows(changesRes[0]);
				if (changesRows.length!=1)
					throw new Error("Expected exactly one number as return");

				return changesRows[0].changes;
				break;

			case "rows":
				let rowRes=sqlite.exec(query);
				if (!rowRes.length)
					return [];

				if (rowRes.length!=1)
					throw new Error("Expected one result, q="+query+" res="+JSON.stringify(rowRes));

				return objectifyRows(rowRes[0]);
				break;

			case "none":
				sqlite.run(query);
				break;

			default:
				throw new Error("Unknown query return type: "+returnType);
		}
	}

	return async function(queries, returnType) {
		let res=[];

		for (let query of queries)
			res.push(await singleQuery(query, returnType))

		return res;
	}
}

export function qqlDriverSqlite(sqlite) {
	function singleQuery(query, returnType) {
		if (!returnType)
			returnType="none";

		return new Promise((resolve,reject)=>{
			switch (returnType) {
				case "id":
					sqlite.run(query,function(err) {
						if (err)
							reject(err);

						else {
							resolve(this.lastID);
						}
					});
					break;

				case "changes":
					sqlite.run(query,function(err) {
						if (err)
							reject(err);

						else {
							resolve(this.changes);
						}
					});
					break;

				case "rows":
					sqlite.all(query,function(err,rows) {
						if (err)
							reject(err);

						else
							resolve(rows);
					});
					break;

				case "none":
					sqlite.run(query,function(err) {
						if (err)
							reject(err);

						else
							resolve();
					});
					break;

				default:
					throw new Error("Unknown query return type: "+returnType);
			}
		})
	}

	return async function(queries, returnType) {
		let res=[];

		for (let query of queries)
			res.push(await singleQuery(query, returnType))

		return res;
	}
}
