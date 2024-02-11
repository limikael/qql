import initSqlJs from "sql.js";
import {qqlSqljs} from "../src/drivers.js";

describe("qql secutiry",()=>{
	it("works",async()=>{
		let SQL=await initSqlJs({
			locateFile: file=>`node_modules/sql.js/dist/${file}`
		});

		let qql=qqlSqljs({
			sqljs: new SQL.Database(),
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

		await qql.migrate();

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