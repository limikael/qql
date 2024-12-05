import sqlite3 from "sqlite3";
import QqlDriverSqlite from "../src/drivers/QqlDriverSqlite.js";

describe("sqlitedriver",()=>{
	it("works",async()=>{
		let driver=new QqlDriverSqlite(new sqlite3.Database(':memory:'));

		await driver.queries([
			"create table users (id integer not null primary key, name text)",
			"insert into users (name) values ('micke')"
		]);

		let id=await driver.query("insert into users (name) values (?)",["micke2"],"id");
		expect(id).toEqual(2);
		//console.log("id: ",id);

		let rows=await driver.query("select * from users",[],"rows");
		expect(rows).toEqual([ { id: 1, name: 'micke' }, { id: 2, name: 'micke2' } ]);
		//console.log("rows: ",rows);
	});
})