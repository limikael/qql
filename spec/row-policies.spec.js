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
						private_info: {type: "text"}
					},
					policies: [
						{roles: ["user"], operations: ["read"], exclude: "private_info"},
						{roles: ["user"], operations: ["update","read"], where: {user_id: "$uid"}},
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

		let r1=await u1qql({oneFrom: "posts", where: {user_id: 1}, includePolicyInfo: true});
		//console.log(r1.$policyInfo);
		expect(r1.$policyInfo).toEqual({
			read: true,
			update: true,
			delete: false,
			readFields: [ 'id', 'title', 'user_id', 'private_info' ],
			updateFields: [ 'id', 'title', 'user_id', 'private_info' ]
		});

		let r2=await u1qql({oneFrom: "posts", where: {user_id: 2}, includePolicyInfo: true});
		//console.log(r2.$policyInfo);
		expect(r2.$policyInfo).toEqual({
			read: true,
			update: false,
			delete: false,
			readFields: [ 'id', 'title', 'user_id' ],
			updateFields: []
		});

		//expect(r2.$policies.length).toEqual(0);

		//console.log(await qql({oneFrom: "posts", where: {user_id: 2}, includeRowPolicies: true}));

		//console.log(await u1qql({oneFrom: "posts", where: {user_id: 2}}));
	});
});