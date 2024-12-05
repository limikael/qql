import sqlite3 from "sqlite3";
import {createQql} from "../src/qql/Qql.js";
import QqlDriverSqlite from "../src/drivers/QqlDriverSqlite.js";

describe("ops",()=>{
	it("works with operators in where clauses",async ()=>{
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
		//qql=qql.role("admin");

		await qql({deleteFrom: "users"});
		await qql({insertInto: "users", set: {name: "micke1", num: 1}});
		await qql({insertInto: "users", set: {name: "micke2", num: 2}});
		await qql({insertInto: "users", set: {name: "micke3", num: 3}});
		await qql({insertInto: "users", set: {name: "someone else"}});

		expect((await qql({manyFrom: "users", where: {"num<":3}})).length).toEqual(2);
		expect((await qql({manyFrom: "users", where: {"num<":10}, limit: 1})).length).toEqual(1);

		let res=await qql({manyFrom: "users", where: {"num<":10}, offset: 0, limit: 2});
		expect(res.length).toEqual(2);

		res=await qql({manyFrom: "users", where: {"name~":"micke"}});
		expect(res.length).toEqual(3);
		//console.log(res);

		await expectAsync(qql({manyFrom: "users", whre: {"num<":10}})).toBeRejected();
	})
})
