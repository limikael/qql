import initSqlJs from "sql.js";
import QqlDriverSqlJs from "../src/drivers/QqlDriverSqlJs.js";

describe("sqljsdriver",()=>{
	it("works",async()=>{
		let SQL=await initSqlJs();
		let sqlite=new SQL.Database();
		let driver=new QqlDriverSqlJs(sqlite);

		await driver.queries(["create table users (id integer primary key,name)"]);

		let insertRes=await driver.queries(["insert into users (name) values ('micke')"],"id");
		expect(insertRes).toEqual([1]);

		let insertRes2=await driver.query("insert into users (name) values (?)",["micke2"],"id");
		expect(insertRes2).toEqual(2);

		let res=await driver.queries(["select * from users"],"rows");
		//console.log(res);
		expect(res).toEqual([ [ { id: 1, name: 'micke' }, { id: 2, name: 'micke2' } ] ]);

		let res2=await driver.query("select * from users where name=?",["micke"],"rows");
		//console.log(res);
		expect(res2).toEqual([ { id: 1, name: 'micke' } ]);

		let changesRes=await driver.queries(["update users set name='micke3' where name='olle'"],"changes");
		expect(changesRes).toEqual([0]);

		let changesRes2=await driver.queries(["update users set name='micke3' where name='micke'"],"changes");
		expect(changesRes2).toEqual([1]);

		let changesRes3=await driver.query("update users set name=? where name=?",["micke4","micke3"],"changes");
		expect(changesRes3).toEqual(1);
	})
})