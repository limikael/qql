import sqlite3 from "sqlite3";
import {qqlDriverSqlite} from "../src/drivers.js";
import QqlServer from "../src/QqlServer.js";
import {createQqlClient} from "../src/QqlClient.js";
import {createQql} from "../src/Qql.js";

describe("qql client",()=>{
	it("works",async()=>{
		let sqliteDriver=qqlDriverSqlite(new sqlite3.Database(':memory:'));
		let qql=createQql(sqliteDriver,{
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
});