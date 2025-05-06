import sqlite3 from "sqlite3";
import {createQql} from "../src/qql/Qql.js";
import QqlDriverSqlite from "../src/drivers/QqlDriverSqlite.js";

describe("qql secutiry",()=>{
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
					},
					policies: [
						{roles: "writer"},
						{roles: "reader", operations: "read"}
					]
				}
			}
		});

		await qql.migrate({log: ()=>{}});

		await qql({insertInto: "users", set: {name: "micke"}});

		let readerQql=qql.env({role: "reader"});
		let res=await readerQql({oneFrom: "users"});
		//let res=await readerQql.query({oneFrom: "users"});
		//let res=await qql.env({role: "reader"}).query({oneFrom: "users"});

		expect(res.name).toEqual("micke");

		await qql.env({role: "writer"}).query({oneFrom: "users"});

		await qql.env({role: "writer"}).query({insertInto: "users", set:{name: "micke2"}});

		await expectAsync(
			qql.env({role: "reader"}).query({insertInto: "users", set:{name: "micke2"}})
		).toBeRejected();

//		await restricted({oneFrom: "users"});
	})
})