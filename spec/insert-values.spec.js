import sqlite3 from "sqlite3";
import {createQql} from "../src/qql/Qql.js";
import QqlDriverSqlite from "../src/drivers/QqlDriverSqlite.js";

describe("insert values",()=>{
	it("works",async ()=>{
		let qql=createQql({
			driver: new QqlDriverSqlite(new sqlite3.Database(":memory:")),
			tables: {
				users: {
					fields: {
						id: {type: "integer", pk: true, notnull: true},
						name: {type: "text"},
						num: {type: "integer"}
					}
				},
			}
		});

		await qql.migrate({log: ()=>{}});

		let querySpy=spyOn(qql,"runQuery").and.callThrough();
		await qql({
			insertInto: "users",
			values: [
				{name: "micke", num: 1},
				{name: "micke2", num: 2},
				{name: "micke", num: 3},
				{name: "micke2", num: 4},
				{name: "micke", num: 5},
				{name: "micke2", num: 6},
				{name: "micke", num: 7},
				{name: "micke2", num: 8},
			],
			batchSize: 3
		});

		//console.log(querySpy.calls.count());
		expect(querySpy.calls.count()).toEqual(3);

		let vals=await qql({manyFrom: "users"});
		//console.log(vals);
		expect(vals.length).toEqual(8);
		expect(vals).toEqual([
			{id: 1, name: "micke", num: 1},
			{id: 2, name: "micke2", num: 2},
			{id: 3, name: "micke", num: 3},
			{id: 4, name: "micke2", num: 4},
			{id: 5, name: "micke", num: 5},
			{id: 6, name: "micke2", num: 6},
			{id: 7, name: "micke", num: 7},
			{id: 8, name: "micke2", num: 8},
		]);
	});
})
