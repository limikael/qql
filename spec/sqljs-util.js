import initSqlJs from "sql.js";
import fs from "fs";

export async function sqljsNew() {
	let SQL=await initSqlJs({
		locateFile: file=>`node_modules/sql.js/dist/${file}`
	});

	let db=new SQL.Database();

	return db;
}

export async function sqljsLoad(fn) {
	let SQL=await initSqlJs({
		locateFile: file=>`node_modules/sql.js/dist/${file}`
	});

	let dbFile=fs.readFileSync(fn);
	let db=new SQL.Database(dbFile);

	return db;
}

export function sqljsCreateRunner(db) {
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
		let res=db.exec(query);
		if (!res.length)
			return [];

		return processResult(res[0]);
	}

	return async queries=>{
		return Promise.all(queries.map(query=>singleQuery(query)));
	}
}
