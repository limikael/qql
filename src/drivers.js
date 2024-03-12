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

function wrapQqlEnv(qqlEnv) {
	let fn=(o)=>qqlEnv.query(o);
	fn.query=fn;
	fn.getTableByName=qqlEnv.qql.getTableByName;
	fn.rootEnv=qqlEnv.qql.rootEnv;
	fn.migrate=(...args)=>qqlEnv.qql.migrate(...args);
	fn.env=(env)=>wrapQqlEnv(qqlEnv.qql.env(env));

	return fn;
}

export function createQql(...args) {
	let conf=objectifyArgs(args,["driver"]);

	if (conf.sqlite)
		conf.driver=qqlDriverSqlite(conf.sqlite);

	let qql=new Qql(conf);
	return wrapQqlEnv(qql.rootEnv);
}