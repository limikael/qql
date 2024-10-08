import sqlite3 from "sqlite3";
import {createQql} from "../src/drivers.js";

describe("qql",()=>{
	it("works",async()=>{
		let qql=createQql({
			sqlite: new sqlite3.Database(':memory:'),
			tables: {
				users: {
					fields: {
						id: {type: "integer", pk: true, notnull: true},
						name: {type: "text"},
					}
				},

				posts: {
					fields: {
						id: {type: "integer", pk: true, notnull: true},
						title: {type: "text"},
						published: {type: "boolean", default: false},
						content: {type: "text"},
						author_id: {type: "reference", reference: "users", prop: "author", /*, refprop: "authored"*/},
						proofreader_id: {type: "reference", reference: "users", prop: "proofreader", refprop: "proofread"}
					}
				},
			}
		});

		await qql.migrate({log: ()=>{}});
		await qql.migrate({log: ()=>{}});
//		qql=qql.role("admin");

		await qql.query({deleteFrom: "users"});
		await qql.query({deleteFrom: "posts"});

		await qql.query({insertInto: "users", set: {id: 1, name: "micke"}});
		await qql.query({insertInto: "users", set: {id: 2, name: "micke2"}});

		await qql.query({insertInto: "posts", set: {id: 1, title: "post 1", author_id: 1, proofreader_id: 2}});
		await qql.query({insertInto: "posts", set: {id: 2, title: "post 2", author_id: 1, published: true}});
		await qql.query({insertInto: "posts", set: {id: 3, title: "post 3", author_id: 2}});
		await qql.query({insertInto: "posts", set: {id: 4, title: "post 4"}});

		expect(
			await qql.query({manyFrom: "posts", where: {published: true}})
		).toEqual(
			[{"id":2,"title":"post 2","published":true,"content":null,"author_id":1,"proofreader_id":null}]
		);

		expect(
			await qql.query({manyFrom: "users", join: {
				"posts": {where: {published: true}},
				"proofread": {}
			}})
		).toEqual(
			[{"id":1,"name":"micke","posts":[{"id":2,"title":"post 2","published":true,"content":null,"author_id":1,"proofreader_id":null}],"proofread":[]},{"id":2,"name":"micke2","posts":[],"proofread":[{"id":1,"title":"post 1","published":false,"content":null,"author_id":1,"proofreader_id":2}]}]
		);

		expect(
			await qql.query({
				manyFrom: "posts", 
				join: ["author","proofreader"]
			})
		).toEqual(
			[
				{"id":1,"title":"post 1","published":false,"content":null,"author_id":1,"proofreader_id":2,"author":{"id":1,"name":"micke"},"proofreader":{"id":2,"name":"micke2"}},
				{"id":2,"title":"post 2","published":true,"content":null,"author_id":1,"proofreader_id":null,"author":{"id":1,"name":"micke"},"proofreader":undefined},
				{"id":3,"title":"post 3","published":false,"content":null,"author_id":2,"proofreader_id":null,"author":{"id":2,"name":"micke2"},"proofreader":undefined},
				{"id":4,"title":"post 4","published":false,"content":null,"author_id":null,"proofreader_id":null,"proofreader":undefined,"author":undefined}
			]
		);
	})
});