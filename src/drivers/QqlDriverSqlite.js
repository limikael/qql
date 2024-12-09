import sqliteSqlstring from "sqlstring-sqlite";

export default class QqlDriverSqlite {
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
