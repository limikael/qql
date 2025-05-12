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

		await qql({
			insertInto: "users",
			values: [
				{name: "micke", num: 123},
				{name: "micke2", num: 345}
			]
		});

		let vals=await qql({manyFrom: "users"});
		//console.log(vals);
		expect(vals).toEqual([
			{ id: 1, name: 'micke', num: 123 },
			{ id: 2, name: 'micke2', num: 345 }
		]);
	});
})
