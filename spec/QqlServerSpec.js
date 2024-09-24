import sqlite3 from "sqlite3";
import {qqlDriverSqlite, createQql} from "../src/drivers.js";
import QqlServer from "../src/QqlServer.js";

describe("qql",()=>{
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

		let qqlServer=new QqlServer(qql,{path: "hello/world"});
		let request=new Request("http://example.com/hello/world",{
			method: "POST",
			body: JSON.stringify({oneFrom: "users"})
		});

		let response=await qqlServer.handleRequest(request);
		let result=await response.json();
		expect(result).toEqual({ id: 1, name: 'micke', num: null, test: null, another: null });

		request=new Request("http://example.com/hello/world",{
			method: "POST",
			body: JSON.stringify({manyFrom: "users", select: ["name","num"]})
		});

		response=await qqlServer.handleRequest(request);
		result=await response.json();
		expect(result).toEqual([ { name: 'micke', num: null }, { name: 'micke2', num: 123 } ]);
	});
});