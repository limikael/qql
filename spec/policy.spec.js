import sqlite3 from "sqlite3";
import {createQql} from "../src/qql/Qql.js";
import QqlDriverSqlite from "../src/drivers/QqlDriverSqlite.js";

describe("policy",()=>{
	async function createAgentQql() {
		let qql=createQql({
			driver: new QqlDriverSqlite(new sqlite3.Database(':memory:')),
			tables: {
				users: {
					fields: {
						id: {type: "integer", pk: true, notnull: true},
						name: {type: "text"},
					},
				},
				agents: {
					fields: {
						id: {type: "integer", pk: true, notnull: true},
						owner_id: {reference: "users"},
						name: {type: "text"},
					},
					policies: [
						{roles: ["user"], where: {owner_id: "$uid"},/*exclude: ["owner_id"]*/}
					]
				},
				resources: {
					fields: {
						id: {type: "integer", pk: true, notnull: true},
						agent_id: {reference: "agents"},
						name: {type: "text"},
					},
					policies: [
						{
							roles: ["user"],
							where: {
								agent_id: {$ref: {
									owner_id: "$uid"
								}}
							}
						}
					]
				}
			}
		});

		await qql.migrate({log: ()=>{}});

		return qql;
	}

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
						published: {type: "boolean", default: false},
						private_notes: {type: "text"}
					},

					policies: [
						{roles: ["admin"]},
						{roles: ["user","public"], where: {published: true}, exclude: ["private_notes"]},
						{roles: ["user"], where: {user_id: "$uid"}}
					]
				},
			}
		});

		await qql.migrate({log: ()=>{}});

		await qql({insertInto: "posts", set: {title: "Hello one", user_id: 1, private_notes: "p1"}});
		await qql({insertInto: "posts", set: {title: "Hello one published", user_id: 1, published: true, private_notes: "p2"}});
		await qql({insertInto: "posts", set: {title: "Hello two", user_id: 2, private_notes: "p3"}});
		await qql({insertInto: "posts", set: {title: "Hello two published", user_id: 2, published: true, private_notes: "p4"}});

		expect((await qql({manyFrom: "posts"})).length).toEqual(4);

		expect((await qql.env({uid: 1, role: "user"}).query({manyFrom: "posts"})).map(r=>r.title)).toEqual(["Hello one","Hello one published"]);
		expect((await qql.env({uid: 1, role: "user"}).query({manyFrom: "posts", unselect: ["private_notes"]})).map(r=>r.title)).toEqual(["Hello one","Hello one published","Hello two published"]);
		expect((await qql.env({role: "admin"}).query({manyFrom: "posts"})).length).toEqual(4);
		expect((await qql.env({role: "public"}).query({manyFrom: "posts", unselect: ["private_notes"]})).map(r=>r.title)).toEqual(["Hello one published","Hello two published"]);
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
						{
							roles: ["user"], 
							operations: ["read","create","update"], 
							exclude: ["password"], 
						}
					]
				},
			}
		});

		await qql.migrate({log: ()=>{}});

		/*console.log(qql.tables["users"].policies[1].getReadFields());
		console.log(qql.tables["users"].policies[1].getWriteFields());*/

		await qql({insertInto: "users", set: {name: "micke", password: "qwerty"}});

		let res=await qql.env({role: "user"}).query({manyFrom: "users", unselect: ["password"]});
		//console.log(res);

		res=await qql({manyFrom: "users"});
		//console.log(res);

		let uqql=qql.env({role: "user"});

		await expectAsync(
			uqql({manyFrom: "users", select: ["password"]})
		).toBeRejectedWithError("read on users not permitted with role user");

		await qql.env({role: "user"}).query({insertInto: "users", set: {name: "micke"}});
		expect(await qql({countFrom: "users"})).toEqual(2);

		await expectAsync(
			uqql({insertInto: "users", set: {name: "micke", password: "awef"}})
		).toBeRejectedWithError("create on users not permitted with role user");

		uqql({insertInto: "users", set: {name: "micke", id: 5}})

		await uqql({update: "users", set: {name: "micke2"}});

		await expectAsync(
			uqql({update: "users", set: {name: "micke2", password: "123"}})
		).toBeRejectedWithError("update on users not permitted with role user");

		await uqql({update: "users", set: {name: "micke2"}});

		//await qql.env({role: "user"}).query({insertInto: "users", set: {name: "micke", password: "qwerty", id: 5}});
	});

	it("can insert",async ()=>{
		let qql=await createAgentQql();

		let mickeId=await qql({insertInto: "users", set: {name: "micke"}});
		let mickeQql=qql.env({uid: mickeId, role: "user"});
		let micke2Id=await qql({insertInto: "users", set: {name: "micke2"}});

		let mickeAgentId=await qql({insertInto: "agents", set: {name: "micke agent", owner_id: mickeId}});
		let micke2AgentId=await qql({insertInto: "agents", set: {name: "micke2 agent", owner_id: micke2Id}});

		await qql({insertInto: "resources", set: {name: "micke resource 1", agent_id: mickeAgentId}});
		await qql({insertInto: "resources", set: {name: "micke resource 2", agent_id: mickeAgentId}});
		await qql({insertInto: "resources", set: {name: "micke2 resource 1", agent_id: micke2AgentId}});
		await qql({insertInto: "resources", set: {name: "micke2 resource 2", agent_id: micke2AgentId}});

		expect((await qql({manyFrom: "agents"})).length).toEqual(2);
		expect((await mickeQql({manyFrom: "agents"})).length).toEqual(1);
		expect((await mickeQql({manyFrom: "resources"})).length).toEqual(2);

		await mickeQql({insertInto: "agents", set:{name: "hello", owner_id: mickeId}});

		await expectAsync(
			mickeQql({insertInto: "agents", set:{name: "hello"}})
		).toBeRejectedWithError("Inserted data not allowed");

		await expectAsync(
			qql({insertInto: "agents", set: {xyz: 123}})
		).toBeRejectedWithError("Unknown fields for insert: xyz");

		//let inserted=await mickeQql({insertInto: "resources", set: {name: "hello"}, return: "item"});
		//let inserted=await mickeQql({insertInto: "resources", set: {name: "hello", agent_id: mickeAgentId}, return: "item"});
		//console.log(inserted);
	});

	it("can update with join",async ()=>{
		let qql=await createAgentQql();

		let mickeId=await qql({insertInto: "users", set: {name: "micke"}});
		let micke2Id=await qql({insertInto: "users", set: {name: "micke2"}});
		let mickeQql=qql.env({uid: mickeId, role: "user"});

		let mickeAgentId=await qql({insertInto: "agents", set: {name: "micke agent", owner_id: mickeId}});
		let micke2AgentId=await qql({insertInto: "agents", set: {name: "micke2 agent", owner_id: micke2Id}});

		await qql({insertInto: "resources", set: {name: "micke resource 1", agent_id: mickeAgentId}});
		await qql({insertInto: "resources", set: {name: "micke resource 2", agent_id: mickeAgentId}});
		await qql({insertInto: "resources", set: {name: "micke2 resource 1", agent_id: micke2AgentId}});
		await qql({insertInto: "resources", set: {name: "micke2 resource 2", agent_id: micke2AgentId}});

		expect((await mickeQql({manyFrom: "resources"})).length).toEqual(2);

		let changes=await mickeQql({update: "resources", set: {name: "other"}, where: {id: 1}});
		expect(changes).toEqual(1);

		let allNames=(await qql({manyFrom: "resources"})).map(row=>row.name);
		//console.log(allNames);
		expect(allNames).toEqual(['other','micke resource 2','micke2 resource 1','micke2 resource 2']);

		changes=await mickeQql({update: "resources", set: {name: "other again"}});
		expect(changes).toEqual(2);

		allNames=(await qql({manyFrom: "resources"})).map(row=>row.name);
		//console.log(allNames);
		expect(allNames).toEqual(['other again','other again','micke2 resource 1','micke2 resource 2']);

		changes=await mickeQql({deleteFrom: "resources", where: {id: 1}});
		expect(changes).toEqual(1);

		changes=await mickeQql({deleteFrom: "resources"});
		expect(changes).toEqual(1);

		allNames=(await qql({manyFrom: "resources"})).map(row=>row.name);
		//console.log(allNames);
		expect(allNames).toEqual(['micke2 resource 1','micke2 resource 2']);

		await mickeQql({insertInto: "resources", set: {name: "new res", agent_id: mickeAgentId}});
		await expectAsync(
			mickeQql({insertInto: "resources", set: {name: "new res", agent_id: micke2AgentId}})
		).toBeRejectedWithError("Inserted data not allowed");
		await expectAsync(
			mickeQql({insertInto: "resources", set: {name: "new res"}})
		).toBeRejectedWithError("Inserted data not allowed");

		await expectAsync(
			mickeQql({insertInto: "agents", set: {name: "new agent", owner_id: micke2Id}})
		).toBeRejectedWithError("Inserted data not allowed");

		let newId=await mickeQql({insertInto: "agents", set: {name: "new agent", owner_id: mickeId}});
		let newRecord=await qql({oneFrom: "agents", where: {id: newId}});

		//console.log(newRecord);
		expect(newRecord).toEqual({ id: 3, owner_id: 1, name: 'new agent' });
	});
});
