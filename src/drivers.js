import Qql from "./Qql.js";
import {objectifyArgs} from "./js-util.js";

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

export function qqlSqlite(...args) {
	let {sqlite, ...conf}=objectifyArgs(args,["sqlite"]);
	return qqlGeneric(qqlDriverSqlite(sqlite),conf);
}

function wrapQqlEnv(qqlEnv) {
	let fn=(o)=>qqlEnv.query(o);
	fn.query=fn;
	fn.migrate=(...args)=>qqlEnv.qql.migrate(...args);
	fn.env=(env)=>wrapQqlEnv(qqlEnv.qql.env(env));

	return fn;
}

export function qqlGeneric(...args) {
	let conf=objectifyArgs(args,["driver"]);
	let qql=new Qql(conf);
	return wrapQqlEnv(qql.rootEnv);
}