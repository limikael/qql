import sqlite3 from "sqlite3";
import {createQql} from "../src/qql/Qql.js";
import QqlDriverSqlite from "../src/drivers/QqlDriverSqlite.js";

describe("row policies",()=>{
	it("words",async()=>{
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
						{roles: ["user"], operations: ["read"]},
						{roles: ["user"], operations: ["update"], where: {user_id: "$uid"}},
					]
				},
			}
		});

		await qql.migrate({log: ()=>{}});

		await qql({insertInto: "users", set: {id: 1, name: "u1"}});
		await qql({insertInto: "users", set: {id: 2, name: "u2"}});

		await qql({insertInto: "posts", set: {id: 1, title: "by u1", user_id: 1}});
		await qql({insertInto: "posts", set: {id: 2, title: "by u2", user_id: 2}});

		let u1qql=qql.env({role: "user", uid: 1});
		let u2qql=qql.env({role: "user", uid: 2});

		let r1=await u1qql({oneFrom: "posts", where: {user_id: 1}, includeRowPolicies: true});
		expect(r1.$policies.length).toEqual(1);

		let r2=await u1qql({oneFrom: "posts", where: {user_id: 2}, includeRowPolicies: true});
		expect(r2.$policies.length).toEqual(0);

		//console.log(await qql({oneFrom: "posts", where: {user_id: 2}, includeRowPolicies: true}));

		//console.log(await u1qql({oneFrom: "posts", where: {user_id: 2}}));
	});
});