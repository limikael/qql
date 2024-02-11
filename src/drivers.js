import Qql from "./Qql.js";
import {objectifyArgs} from "./js-util.js";

export function qqlSqljs(...args) {
	let conf=objectifyArgs(args,["sqljs"]);
	let sqljs=conf.sqljs;	

	function processResult(result) {
		let rows=[];
		for (let v of result.values) {
			let row={};
			for (let i=0; i<result.columns.length; i++) {
				let c=result.columns[i]
				row[c]=v[i];
			}

			rows.push(row);
		}

		return rows;
	}

	async function singleQuery(query) {
		let res=sqljs.exec(query);
		if (!res.length)
			return [];

		return processResult(res[0]);
	}

	conf.driver=async queries=>{
		return Promise.all(queries.map(query=>singleQuery(query)));
	}

	return qqlGeneric(conf);
}

export function qqlSqlite(...args) {
	let conf=objectifyArgs(args,["sqlite"]);
	let sqlite=conf.sqlite;	

	function singleQuery(query) {
		return new Promise((resolve,reject)=>{
			sqlite.all(query,(err,rows)=>{
				//console.log(rows);

				if (err)
					reject(err);

				else
					resolve(rows);
			});
		})
	}

	conf.driver=async queries=>{
		let res=[];

		for (let query of queries)
			res.push(await singleQuery(query))

		return res;
	};

	return qqlGeneric(conf); 
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