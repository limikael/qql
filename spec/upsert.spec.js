import sqlite3 from "sqlite3";
import {qqlDriverSqlite} from "../src/drivers.js";
import {createQql} from "../src/Qql.js";

describe("qql",()=>{
	it("works",async()=>{
		let qql=createQql({
			driver: qqlDriverSqlite(new sqlite3.Database(':memory:')),
			tables: {
				users: {
					fields: {
						id: {type: "integer", pk: true, notnull: true},
						name: {type: "text"},
						num: {type: "integer"},
						test: {type: "json"},
						another: {type: "text"}
					}
				}
			}
		});

		await qql.migrate({log: ()=>{}});

		await qql({insertInto: "users", set: {name: "micke"}});
		await qql({insertInto: "users", set: {name: "micke2"}});

		let u=await qql({manyFrom: "users"});
		expect(u.length).toEqual(2);

		let changes=await qql({update: "users", set: {num: 123}, where: {name: "micke"}});
		expect(changes).toEqual(1);

		let changes2=await qql({update: "users", set: {num: 123}, where: {name: "mickeqwerty"}});
		expect(changes2).toEqual(0);

		await qql({upsert: "users", set: {num: 456}, where: {name: "micke"}});
		expect(await qql({countFrom: "users"})).toEqual(2);

		await qql({upsert: "users", set: {num: 789}, where: {name: "micke3"}});
		//console.log(await qql({manyFrom: "users"}));
		expect(await qql({countFrom: "users"})).toEqual(3);

		await qql({upsert: "users", set: {num: 1234}, where: {name: "micke3"}});
		expect(await qql({countFrom: "users"})).toEqual(3);

		//console.log(await qql({manyFrom: "users"}));
	});
})