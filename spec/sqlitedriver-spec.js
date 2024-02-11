import sqlite3 from "sqlite3";
import {qqlDriverSqlite} from "../src/drivers.js";

describe("sqlitedriver",()=>{
	it("works",async()=>{
		let sqlite=new sqlite3.Database(':memory:');
		let sqliteDriver=qqlDriverSqlite(sqlite);

		await sqliteDriver(["create table users (id integer primary key,name)"]);
		let insertRes=await sqliteDriver(["insert into users (name) values ('micke')"],"id");
		expect(insertRes).toEqual([1]);
		let res=await sqliteDriver(["select * from users"],"rows");
		expect(res).toEqual([ [ { id: 1, name: 'micke' } ] ]);
	})
})