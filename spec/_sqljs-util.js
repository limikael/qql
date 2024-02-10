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
