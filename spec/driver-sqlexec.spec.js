import sqlite3 from "sqlite3";
import QqlDriverSqlExec from "../src/drivers/QqlDriverSqlExec.js";

describe("sql exec driver",()=>{
	it("works",async()=>{
		let calls=[];

		let driver=new QqlDriverSqlExec(async sql=>{
			calls.push(sql);
		});

		await driver.queries(["SELECT * FROM test","SELECT * FROM test2"],"none");
		await driver.query("SELECT * FROM test",[],"none");

		expect(calls[0]).toEqual("SELECT * FROM test; SELECT * FROM test2");
		expect(calls[1]).toEqual("SELECT * FROM test");
	});
})