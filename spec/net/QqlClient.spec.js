import sqlite3 from "sqlite3";
import QqlServer from "../../src/net/QqlServer.js";
import {createQqlClient} from "../../src/net/QqlClient.js";
import {createQql} from "../../src/qql/Qql.js";
import QqlDriverSqlite from "../../src/drivers/QqlDriverSqlite.js";

describe("qql client",()=>{
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
		await qql({insertInto: "users", set: {name: "micke2",num: 123}});

		let qqlServer=new QqlServer(qql);

		let qqlClient=createQqlClient({
			url: "http://bla",
			fetch: (...args)=>{
				return qqlServer.handleRequest(new Request(...args))
			}
		});

		let users=await qqlClient({manyFrom: "users"});
		//console.log(users);
		expect(users.length).toEqual(2);
	});

	it("can hydrate",async()=>{
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
		await qql({insertInto: "users", set: {name: "micke2",num: 123}});

		let qqlServer=new QqlServer(qql);

		let qqlClient=createQqlClient({
			url: "http://bla",
			fetch: (...args)=>{
				return qqlServer.handleRequest(new Request(...args))
			}
		});

		let users=await qqlClient({manyFrom: "users", hydrate: Object});
		//console.log(users);
		expect(users.length).toEqual(2);

		users[0].name="hello";
		await users[0].save();
	});
});