import sqlite3 from "sqlite3";
import {qqlSqlite} from "../src/drivers.js";

describe("qql views",()=>{
	it("works",async()=>{
		let qql=qqlSqlite({
			sqlite: new sqlite3.Database(':memory:'),
			tables: {
				users: {
					access: "admin",
					fields: {
						id: {type: "integer", pk: true, notnull: true},
						name: {type: "text"},
					}
				},

				posts: {
					access: "admin",
					fields: {
						id: {type: "integer", pk: true, notnull: true},
						title: {type: "text"},
						content: {type: "text"},
						user: {type: "reference", reference: "users"}
					}
				},

				/*my_posts: {
					viewFrom: "posts"
				}*/
			}
		});

		await qql.migrate();

		let uid=await qql({insertInto: "users", set: {name: "micke"}});
		let uid2=await qql({insertInto: "users", set: {name: "micke2"}});
		await qql({insertInto: "posts", set: {title: "micke post 1", user_id: uid}});
		await qql({insertInto: "posts", set: {title: "micke post 2", user_id: uid}});
		await qql({insertInto: "posts", set: {title: "micke2 post 1", user_id: uid2}});
	})
})