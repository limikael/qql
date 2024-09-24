import sqlite3 from "sqlite3";
import {createQql} from "../src/drivers.js";

describe("qql secutiry",()=>{
	it("works",async()=>{
		let qql=createQql({
			sqlite: new sqlite3.Database(':memory:'),
			tables: {
				users: {
					access: "writer",
					readAccess: "reader",
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

		await qql.env({role: "reader"}).query({oneFrom: "users"});
		await qql.env({role: "writer"}).query({oneFrom: "users"});

		await qql.env({role: "writer"}).query({insertInto: "users", set:{name: "micke2"}});

		await expectAsync(
			qql.env({role: "reader"}).query({insertInto: "users", set:{name: "micke2"}})
		).toBeRejected();

//		await restricted({oneFrom: "users"});
	})
})