import {qqlSqlite} from "../src/drivers.js";
import sqlite3 from "sqlite3";

describe("qql-util",()=>{
	it("can canonicalize joins",async ()=>{
		let qql=qqlSqlite({
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

		await qql.migrate();

		await qql({deleteFrom: "users"});
		await qql({insertInto: "users", set: {name: "micke1", num: 1}});
		await qql({insertInto: "users", set: {name: "micke2", num: 2}});
		await qql({insertInto: "users", set: {name: "micke3", num: 3}});

		expect((await qql({manyFrom: "users", where: {"num<":3}})).length).toEqual(2);
		expect((await qql({manyFrom: "users", where: {"num<":10}, limit: 1})).length).toEqual(1);

		let res=await qql({manyFrom: "users", where: {"num<":10}, offset: 0, limit: 2});
		expect(res.length).toEqual(2);
	})
})
