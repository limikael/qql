import WhereClause, {canonicalizeCondition} from "../../src/clause/WhereClause.js";
import QqlDriverBase from "../../src/drivers/QqlDriverBase.js";
import QqlDriverSqlite from "../../src/drivers/QqlDriverSqlite.js";
import Qql from "../../src/qql/Qql.js";
import sqlite3 from "sqlite3";

describe("where clause logical ops",()=>{
	async function createAgentsAndResourcesQql() {
		let qql=new Qql({
			driver: new QqlDriverSqlite(new sqlite3.Database(':memory:')),
			tables: {
				users: {
					fields: {
						id: {type: "integer", pk: true},
						role: {type: "text"}
					}
				},
				agents: {
					fields: {
						id: {type: "integer", pk: true},
						user_id: {reference: "users"},
						tier: {type: "text"},
					}
				},
				resources: {
					fields: {
						id: {type: "integer", pk: true},
						name: {type: "text"},
						agent_id: {reference: "agents"},
						subagent_id: {reference: "agents"},
						user_id: {reference: "users"}
					}
				}
			}
		});

		await qql.migrate({log: ()=>{}});

		return qql;
	}

	it("basically works",async ()=>{
		let qql=await createAgentsAndResourcesQql();
		let w=new WhereClause({qql: qql, tableName: "resources", where: {
			$or: [
				{
					user_id: 1
				},
				{
					user_id: 2
				}
			]
		}});

		//console.log(w.getJoins());
		//console.log(w.getWhereClause());
		//console.log(w.getValues());

		expect(w.getWhereClause()).toEqual("WHERE (`user_id`=? OR `user_id`=?)");
		expect(w.getValues()).toEqual([1,2]);
	});

	it("works with empty and",async ()=>{
		let qql=await createAgentsAndResourcesQql();
		let w=new WhereClause({qql, tableName: "resources", where: {
			name: "hello",
			$and: [{},{},{name: "hello2"}]
		}});

		//console.log(w.getWhereClause());
		expect(w.getWhereClause()).toEqual("WHERE `name`=? AND (`name`=?)");

		//console.log(w.getValues());
		expect(w.getValues()).toEqual(["hello","hello2"]);
	});

	it("works with empty or",async ()=>{
		let qql=await createAgentsAndResourcesQql();
		let w=new WhereClause({qql, tableName: "resources", where: {
			name: "hello",
			$or: [{name: "hello2"},{$or: [{name: "hello3"},{}]}]
		}});

		//console.log(w.getWhereClause());
		expect(w.getWhereClause()).toEqual("WHERE `name`=?");

		//console.log(w.getValues());
		expect(w.getValues()).toEqual(["hello"]);
	});

	it("works with empty or and joins",async ()=>{
		let qql=await createAgentsAndResourcesQql();
		let w=new WhereClause({qql, tableName: "resources", where: {
			name: "hello",
			$or: [
				{name: "hello2"},
				{$or: [
					{name: "hello3"},
					{agent_id: {$ref: {
						id: 5
					}}},
					{}
				]}
			]
		}});

		//console.log(w.getWhereClause());
		expect(w.getWhereClause()).toEqual("WHERE `name`=?");

		//console.log(w.getValues());
		expect(w.getValues()).toEqual(["hello"]);

		//console.log(w.getJoins());
		expect(w.getJoins()).toEqual([]);
	});

	it("can process a condition with logical op and join",async ()=>{
		let qql=await createAgentsAndResourcesQql();

		let w=new WhereClause({
			qql: qql,
			tableName: "resources",
			where: {
				agent_id: {$ref: {
					user_id: 123,
				}},
				$or: [
					{
						agent_id: {$ref: {
							user_id: {$ref: {
								role: "user"
							}},
						}},
					},
					{
						agent_id: {$ref: {
							user_id: {$ref: {
								role: "admin"
							}},
						}},
					}
				]
			}
		});

		//console.log(w.getJoins());
		//console.log(w.getWhereClause());
		//console.log(w.getValues());

		expect(w.getWhereClause()).toEqual("WHERE `_j1`.`user_id`=? AND (`_j3`.`role`=? OR `_j5`.`role`=?)");
	});
});