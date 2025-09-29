import sqlite3 from "sqlite3";
import BetterSqlite3Database from "better-sqlite3";
import QqlDriverSqlite from "../../src/drivers/QqlDriverSqlite.js";
import QqlDriverBetterSqlite3 from "../../src/drivers/QqlDriverBetterSqlite3.js";
import QqlDriverPostgres from "../../src/drivers/QqlDriverPostgres.js";
import QqlDriverLibSql from "../../src/drivers/QqlDriverLibSql.js";
import {createClient} from "@libsql/client";
import pg from 'pg';

export function describeForEachDriver(description, fn) {
	let drivers=[
		new QqlDriverSqlite(new sqlite3.Database(":memory:")),
		new QqlDriverBetterSqlite3(new BetterSqlite3Database(":memory:")),
		new QqlDriverLibSql({client: createClient({url: "file::memory:"})})
	];

	let PG_CONNECTION;
	//let PG_CONNECTION="postgresql://micke:getter@localhost/test";
	//let PG_CONNECTION=process.env.PG_CONNECTION;
	if (PG_CONNECTION) {
		let pool=new pg.Pool({connectionString: PG_CONNECTION});
		let pgDriver=new QqlDriverPostgres({pool: pool});
		drivers.push(pgDriver);
	}

	for (let driver of drivers) {
		describe(description,()=>{
			beforeEach(async ()=>{
				for (let table of await driver.describe())
					await driver.query(`DROP TABLE ${driver.escapeId(table.name)}`,[]);
			});

			fn(driver);
		});
	}
}