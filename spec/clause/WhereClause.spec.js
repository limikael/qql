import WhereClause, {canonicalizeCondition} from "../../src/clause/WhereClause.js";
import QqlDriverBase from "../../src/drivers/QqlDriverBase.js";
import QqlDriverSqlite from "../../src/drivers/QqlDriverSqlite.js";
import Qql from "../../src/qql/Qql.js";
import sqlite3 from "sqlite3";

describe("where clause",()=>{
	it("can canonicalize a condition",()=>{
		let o1=canonicalizeCondition({a: 123});
		//console.log(o1);
		expect(o1).toEqual({a: {$eq: 123}});

		let o2=canonicalizeCondition({a: {$gt: 123, $lt: 124}});
		//console.log(o2);
		expect(o2).toEqual({ a: { '$gt': 123, '$lt': 124 } });

		let o3=canonicalizeCondition({"a>": 123, "a": 124});
		//console.log(o3);
		expect(o3).toEqual({ a: { '$gt': 123, '$eq': 124 } });

		expect(()=>{
			let o4=canonicalizeCondition({"a>": {$gt: 123}});
			//console.log(o4);
		}).toThrow();

		let o5=canonicalizeCondition({a: 123, $and: [{a: 1},{b:{$eq: 2}}]});
		//console.log(JSON.stringify(o5));
		expect(JSON.stringify(o5)).toEqual('{"a":{"$eq":123},"$and":[{"a":{"$eq":1}},{"b":{"$eq":2}}]}');

		let o6=canonicalizeCondition({a: [1,2,3]});
		//console.log(o6);
		expect(o6).toEqual({ a: { '$in': [ 1, 2, 3 ] } });
	});

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
						name: {type: "text"}
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

	it("can process a simple condition",()=>{
		let qql=new Qql({
			driver: new QqlDriverBase({escapeFlavor: "sqlite"}),
			tables: {
				agents: {
					fields: {
						id: {type: "integer", pk: true},
						a: {type: "integer"},
						b: {type: "integer"}
					}
				}
			}
		});

		let w=new WhereClause({
			qql: qql,
			where: {a: 1, b:{$gt: 5, $lt: 10}},
			tableName: "agents"
		});

		//let res=w.process();
		//console.log(res);

		//console.log(w.getWhereClause());
		//console.log(w.getValues());
	});

	it("can use substring",async ()=>{
		let qql=new Qql({
			driver: new QqlDriverBase({escapeFlavor: "sqlite"}),
			tables: {
				hellotable: {
					fields: {
						id: {type: "integer", pk: true},
						name: {type: "text"},
					}
				}
			}
		});

		let w=new WhereClause({
			qql: qql,
			tableName: "hellotable",
			where: {"name~": "icke"}
		});

		//console.log(w.getWhereClause());
		//console.log(w.getValues());

		expect(w.getWhereClause()).toEqual("WHERE UPPER(`hellotable`.`name`) LIKE ?");
		expect(w.getValues()).toEqual([ '%ICKE%' ]);

		expect(await w.match({name: "micke"},"strict")).toEqual(true);
		expect(await w.match({name: "m"},"strict")).toEqual(false);
	});

	it("can use sets",async ()=>{
		let qql=new Qql({
			driver: new QqlDriverBase({escapeFlavor: "sqlite"}),
			tables: {
				hellotable: {
					fields: {
						id: {type: "integer", pk: true},
						name: {type: "text"},
					}
				}
			}
		});

		let w=new WhereClause({
			qql: qql,
			tableName: "hellotable",
			where: {"name": ["micke","someone"]}
		});

		//console.log(w.getWhereClause());
		//console.log(w.getValues());

		expect(w.getWhereClause()).toEqual("WHERE `hellotable`.`name` IN (?,?)");
		expect(w.getValues()).toEqual([ 'micke', 'someone' ]);

		expect(await w.match({name: "micke"},"strict")).toEqual(true);
		expect(await w.match({name: "someone"},"strict")).toEqual(true);
		expect(await w.match({name: "bla"},"strict")).toEqual(false);
	});

	it("can process a condition with ref",async ()=>{
		let qql=await createAgentsAndResourcesQql();

		let w=new WhereClause({
			qql: qql,
			tableName: "resources",
			where: {
				agent_id: {$ref: {
					user_id: 123,
				}},
				subagent_id: {$ref: {
					tier: "sub",
					user_id: {$ref: {
						role: "admin"
					}}
				}},
				user_id: {$ref: {
					role: "user"
				}},
				id: 1,
			}
		});

		//console.log(w.getJoinClause());
		//console.log(w.getWhereClause());
		//console.log(w.getValues());

		//expect(w.getJoinClause()).toEqual("LEFT JOIN `agents` AS _j1 ON `resources`.`agent_id`=_j1.`id` LEFT JOIN `agents` AS _j2 ON `resources`.`subagent_id`=_j2.`id` LEFT JOIN `users` AS _j3 ON `_j2`.`user_id`=_j3.`id` LEFT JOIN `users` AS _j4 ON `resources`.`user_id`=_j4.`id`");
		expect(w.getJoinClause()).toEqual("LEFT JOIN `agents` AS `_j1` ON `resources`.`agent_id`=`_j1`.`id` LEFT JOIN `agents` AS `_j2` ON `resources`.`subagent_id`=`_j2`.`id` LEFT JOIN `users` AS `_j3` ON `_j2`.`user_id`=`_j3`.`id` LEFT JOIN `users` AS `_j4` ON `resources`.`user_id`=`_j4`.`id`");
		expect(w.getWhereClause()).toEqual("WHERE `_j1`.`user_id`=? AND `_j2`.`tier`=? AND `_j3`.`role`=? AND `_j4`.`role`=? AND `resources`.`id`=?");
		expect(w.getValues()).toEqual([ 123, 'sub', 'admin', 'user', 1 ]);
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

	it("can check if a record matches",async ()=>{
		let qql=await createAgentsAndResourcesQql();

		let w=new WhereClause({
			qql: qql, 
			tableName: "resources",
			where: {
				id: 1,
				agent_id: 8
			}
		});

		expect(await w.match({id: 1, agent_id: 8},"strict")).toEqual(true);
		expect(await w.match({id: 1},"compatible")).toEqual(true);
		expect(await w.match({id: 2},"strict")).toEqual(false);
		expect(await w.match({},"strict")).toEqual(false);
		expect(await w.match({},"compatible")).toEqual(true);
	});

	it("can check with logical condition",async ()=>{
		let qql=await createAgentsAndResourcesQql();

		let w=new WhereClause({
			qql: qql, 
			tableName: "resources",
			where: {
				$or: [{id: 1},{id: 2}]
			}
		});

		expect(await w.match({id: 1},"strict")).toEqual(true);
		expect(await w.match({id: 2},"strict")).toEqual(true);
		expect(await w.match({id: 3},"strict")).toEqual(false);
		expect(await w.match({},"strict")).toEqual(false);

		let w2=new WhereClause({
			qql: qql, 
			tableName: "resources",
			where: {
				$and: [{"id>": 1},{"id<": 10}]
			}
		});

		expect(await w2.match({id: 0},"strict")).toEqual(false);
		expect(await w2.match({id: 5},"strict")).toEqual(true);
		expect(await w2.match({id: 11},"strict")).toEqual(false);
	});

	it("can check with reference",async ()=>{
		let qql=await createAgentsAndResourcesQql();

		let w=new WhereClause({
			qql: qql, 
			tableName: "resources",
			where: {
				agent_id: {$ref: {
					$or: [{tier: "sub"},{tier: "main"}]
				}}
			}
		});

		let agentId1=await qql({insertInto: "agents", set: {
			tier: "sub"
		}});

		let agentId2=await qql({insertInto: "agents", set: {
			tier: "main"
		}});

		let agentId3=await qql({insertInto: "agents", set: {
			tier: "something"
		}});

		//console.log(await w.match({agent_id: agentId}));
		expect(await w.match({agent_id: agentId1},"strict")).toEqual(true);
		expect(await w.match({agent_id: agentId2},"strict")).toEqual(true);
		expect(await w.match({agent_id: agentId3},"strict")).toEqual(false);

		//expect(w.match({agent_id: 1}));
	});

	it("can map values",async ()=>{
		let qql=await createAgentsAndResourcesQql();

		let w=new WhereClause({
			qql: qql, 
			tableName: "resources",
			where: {
				name: "$uid",
				agent_id: {$ref: {
					tier: "$tier"
				}},
				$and: [{agent_id: "$uid"},{agent_id: "blabla"}]
			}
		});

		let w2=w.mapValues(v=>{
			if (v=="$uid")
				return 1234;

			if (v=="$tier")
				return "THETIER";

			return v;
		});

		//console.log(JSON.stringify(w2.where));
		expect(JSON.stringify(w2.where)).toEqual('{"name":{"$eq":1234},"agent_id":{"$ref":{"tier":{"$eq":"THETIER"}}},"$and":[{"agent_id":{"$eq":1234}},{"agent_id":{"$eq":"blabla"}}]}');
	});

	it("works works with adding a where",async ()=>{
		let qql=await createAgentsAndResourcesQql();

		let w=new WhereClause({
			qql: qql,
			tableName: "agents",
			where: {
				$and: [{},{}]
			}
		});

		w.addOrWhereClause({
			qql: qql,
			tableName: "agents",
			where: {tier: "main"}
		});

		w.addOrWhereClause({
			qql: qql,
			tableName: "agents",
		});

		//console.log(w.getWhereClause());
		expect(w.getWhereClause()).toEqual("");
	});

	it("can populate reversible fields",async()=>{
		let qql=await createAgentsAndResourcesQql();

		let w=new WhereClause({
			qql: qql,
			tableName: "agents",
			where: {
				user_id: 5,
				name: "hello"
			}
		});

		let record={tier: "sub", name: "something else"};
		w.populateReversible(record);

		//console.log(record);
		expect(record).toEqual({tier: "sub", user_id: 5, name: "something else"})
	});

	it("can populate reversible fields with and",async()=>{
		let qql=await createAgentsAndResourcesQql();

		let w=new WhereClause({
			qql: qql,
			tableName: "agents",
			where: {
				name: "hello",
				$and: [{user_id: 5}]
			}
		});

		let record={tier: "sub", name: "something else"};
		w.populateReversible(record);

		//console.log(record);
		expect(record).toEqual({tier: "sub", user_id: 5, name: "something else"})
	});
});