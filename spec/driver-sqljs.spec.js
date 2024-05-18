import initSqlJs from "sql.js";
import {qqlDriverSqlJs} from "../src/drivers.js";

describe("sqljsdriver",()=>{
	it("works",async()=>{
		let SQL=await initSqlJs();
		let sqlite=new SQL.Database();
		let sqliteDriver=qqlDriverSqlJs(sqlite);

		await sqliteDriver(["create table users (id integer primary key,name)"]);
		let insertRes=await sqliteDriver(["insert into users (name) values ('micke')"],"id");
		expect(insertRes).toEqual([1]);
		let res=await sqliteDriver(["select * from users"],"rows");
		expect(res).toEqual([ [ { id: 1, name: 'micke' } ] ]);

		let changesRes=await sqliteDriver(["update users set name='micke2' where name='olle'"],"changes");
		expect(changesRes).toEqual([0]);

		let changesRes2=await sqliteDriver(["update users set name='micke2' where name='micke'"],"changes");
		expect(changesRes2).toEqual([1]);
	})
})