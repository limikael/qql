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

	it("checks for just one policy per role",async ()=>{
		expect(()=>{
			let qql=createQql({
				driver: new QqlDriverSqlite(new sqlite3.Database(':memory:')),
				tables: {
					users: {
						fields: {
							id: {type: "integer", pk: true, notnull: true},
							name: {type: "text"},
							password: {type: "text"}
						},

						policies: [
							{roles: ["admin","user"], operations: []},
							{roles: ["user"], operations: ["read"]}
						]
					},
				}
			});
		}).toThrow(new Error("Ambigous policy for role: user, table: users"));
	});

	it("checks for just one policy per role",async ()=>{
		expect(()=>{
			let qql=createQql({
				driver: new QqlDriverSqlite(new sqlite3.Database(':memory:')),
				tables: {
					users: {
						fields: {
							id: {type: "integer", pk: true, notnull: true},
							name: {type: "text"},
							password: {type: "text"}
						},

						policies: [
							{roles: ["admin","user"], operations: []},
							{roles: ["user"], operations: ["read"]}
						]
					},
				}
			});
		}).toThrow(new Error("Ambigous policy for role: user, table: users"));
	});

	it("handles role fields",async ()=>{
		let qql=createQql({
			driver: new QqlDriverSqlite(new sqlite3.Database(':memory:')),
			tables: {
				users: {
					fields: {
						id: {type: "integer", pk: true, notnull: true},
						name: {type: "text"},
						password: {type: "text"}
					},

					policies: [
						{roles: ["admin"]},
						{roles: ["user"], operations: ["read"], exclude: ["password"]}
					]
				},
			}
		});

		await qql.migrate({log: ()=>{}});

		/*console.log(qql.tables["users"].policies[1].getReadFields());
		console.log(qql.tables["users"].policies[1].getWriteFields());*/

		await qql({insertInto: "users", set: {name: "micke", password: "qwerty"}});

		let res=await qql.env({role: "user"}).query({manyFrom: "users"});
		//console.log(res);

		res=await qql({manyFrom: "users"});
		//console.log(res);
	});
});
