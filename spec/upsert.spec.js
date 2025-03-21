import sqlite3 from "sqlite3";
import QqlDriverSqlite from "../src/drivers/QqlDriverSqlite.js";
import {createQql} from "../src/qql/Qql.js";

describe("qql",()=>{
	it("works",async()=>{
		let qql=createQql({
			driver: new QqlDriverSqlite(new sqlite3.Database(':memory:')),
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

	it("works with null values",async()=>{
		let qql=createQql({
			driver: new QqlDriverSqlite(new sqlite3.Database(':memory:')),
			//driver: new QqlDriverSqlite(new sqlite3.Database('hello.db')),
			tables: {
				vals: {
					fields: {
						id: {type: "integer", pk: true, notnull: true},
						sometext: {type: "text"},
						somenum: {type: "integer"},
						val: {type: "text"}
					}
				}
			}
		});

		await qql.migrate({log: ()=>{}});

		await qql({upsert: "vals", where: {sometext: "hello", somenum: null}, set: {val: "helloval"}});
		await qql({upsert: "vals", where: {sometext: "hello", somenum: null}, set: {val: "helloval2"}});

		//console.log(await qql({manyFrom: "vals", where: {somenum: null}}));
		expect((await qql({manyFrom: "vals"})).length).toEqual(1);

		//await qql({upsert: "vals", where: {sometext: "hello", somenum: 1}, set: {val: "helloval"}});
		//await qql({upsert: "vals", where: {sometext: "hello", somenum: null}, set: {val: "helloval"}});

		/*await qql({upsert: "vals", where: {sometext: "hello", somenum: null}, set: {val: "helloval"}});
		await qql({upsert: "vals", where: {sometext: "hello", somenum: null}, set: {val: "helloval2"}});*/
	})
})