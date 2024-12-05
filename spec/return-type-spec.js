import sqlite3 from "sqlite3";
import {createQql} from "../src/qql/Qql.js";
import QqlDriverSqlite from "../src/drivers/QqlDriverSqlite.js";

describe("qql return type",()=>{
	it("works",async()=>{
		let qql=createQql({
			driver: new QqlDriverSqlite(new sqlite3.Database(':memory:')),
			tables: {
				users: {
					access: "writer",
					readAccess: "reader",
					fields: {
						id: {type: "integer", pk: true, notnull: true},
						name: {type: "text"},
						num: {type: "integer", default: 123},
					}
				}
			}
		});

		await qql.migrate({log: ()=>{}});

		/*let v=await qql({insertInto: "users", set: {name: "micke"}, return: "id"});
		expect(v).toEqual(1);*/

		let v=await qql({insertInto: "users", set: {name: "micke"}, return: "item"});
		expect(v).toEqual({name: "micke",id: 1,num: 123});

		let res=await qql({update: "users", set: {name: "micke2"}, where: {id: 1}});
		expect(res).toEqual(1);

		let res2=await qql({update: "users", set: {name: "micke2"}, where: {id: 1}, return: "item"});
		expect(res2).toEqual({id: 1, name: "micke2", num: 123});

		/*let res3=await qql({deleteFrom: "users", where: {id: 1}, return: "changes"});
		expect(res3).toEqual(1);*/

		let res3=await qql({deleteFrom: "users", where: {id: 1}, return: "item"});
		expect(res3).toEqual({id: 1, name: "micke2", num: 123});
	})
})