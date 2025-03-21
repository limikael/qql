import sqlite3 from "sqlite3";
import QqlDriverSqlite from "../src/drivers/QqlDriverSqlite.js";
import {createQql} from "../src/qql/Qql.js";

describe("qql can handle null values when doing where",()=>{
	it("works",async()=>{
		let qql=createQql({
			driver: new QqlDriverSqlite(new sqlite3.Database(':memory:')),
//			driver: new QqlDriverSqlite(new sqlite3.Database('hello.db')),
			tables: {
				vals: {
					fields: {
						id: {type: "integer", pk: true, notnull: true},
						name: {type: "text"},
						num: {type: "integer"},
					}
				}
			}
		});

		await qql.migrate({log: ()=>{}});

		await qql({insertInto: "vals", set: {name: "hello", num: 1}});
		await qql({insertInto: "vals", set: {name: "hello", num: null}});
		await qql({insertInto: "vals", set: {name: "hello"}});

		expect((await qql({manyFrom: "vals", where: {num: null}})).length).toEqual(2);
	});
})