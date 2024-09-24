import {createQql} from "../src/drivers.js";
import sqlite3 from "sqlite3";

describe("aggregate",()=>{
	it("works with count",async ()=>{
		let qql=createQql({
			sqlite: new sqlite3.Database(":memory:"),
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

		await qql({insertInto: "users", set: {name: "micke1", num: 1}});
		await qql({insertInto: "users", set: {name: "micke2", num: 2}});
		await qql({insertInto: "users", set: {name: "micke3", num: 3}});

		expect((await qql({countFrom: "users"}))).toEqual(3);
		expect((await qql({countFrom: "users", where: {"num<":3}}))).toEqual(2);
	})
})
