import sqlite3 from "sqlite3";
import {createQql} from "../src/qql/Qql.js";
import QqlDriverSqlite from "../src/drivers/QqlDriverSqlite.js";

describe("policy",()=>{
	it("basically works",async ()=>{
		let qql=createQql({
			driver: new QqlDriverSqlite(new sqlite3.Database(':memory:')),
			tables: {
				users: {
					fields: {
						id: {type: "integer", pk: true, notnull: true},
						name: {type: "text"}
					}
				},

				posts: {
					fields: {
						id: {type: "integer", pk: true, notnull: true},
						title: {type: "text"},
						user_id: {type: "reference", reference: "users"},
					},

					policies: [
						{roles: ["admin"]},
						{roles: ["user"], where: {user_id: "$uid"}}
					]
				},
			}
		});

		await qql.migrate({log: ()=>{}});

		await qql({insertInto: "posts", set: {title: "Hello one", user_id: 1}});
		await qql({insertInto: "posts", set: {title: "Hello two", user_id: 2}});

		expect((await qql({manyFrom: "posts"})).length).toEqual(2);

		expect((await qql.env({uid: 1, role: "user"}).query({manyFrom: "posts"})).length).toEqual(1);
		expect((await qql.env({role: "admin"}).query({manyFrom: "posts"})).length).toEqual(2);
	});
});
