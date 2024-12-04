import sqlite3 from "sqlite3";
import {qqlDriverSqlite} from "../src/drivers.js";
import {createQql} from "../src/Qql.js";

/*export function createQql(...args) {
	let conf=objectifyArgs(args,["driver"]);

	if (conf.sqlite)
		conf.driver=qqlDriverSqlite(conf.sqlite);

	let qql=new Qql(conf);
	return wrapQqlEnv(qql.rootEnv);
}*/

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
		await qql({insertInto: "users", set: {name: "micke2"}});

		let a;

		a=await qql({manyFrom: "users"});
		expect(a.length).toEqual(2);
		a=await qql({manyFrom: "users", where: {name: "micke"}});
		expect(a.length).toEqual(1);
		expect(a[0].name).toEqual("micke");

		await qql({update: "users", set: {name: "micke3"}, where: {name: "micke2"}});

		await qql({deleteFrom: "users", where: {name: "micke"}});
		a=await qql({manyFrom: "users"});
		expect(a.length).toEqual(1);
		expect(a[0].name).toEqual("micke3");

		a=await qql({oneFrom: "users"});
		expect(a.name).toEqual("micke3");
	})
})