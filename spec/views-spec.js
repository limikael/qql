import sqlite3 from "sqlite3";
import {createQql} from "../src/qql/Qql.js";
import QqlDriverSqlite from "../src/drivers/QqlDriverSqlite.js";

describe("qql views",()=>{
	it("works",async()=>{
		let qql=createQql({
			driver: new QqlDriverSqlite(new sqlite3.Database(':memory:')),
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
						user_id: {type: "reference", reference: "users"},
						meta: {type: "json"},
						published: {type: "boolean", notnull: true, default: false}
					}
				},

				published_posts: {
					viewFrom: "posts",
					where: {
						published: true,
					}
				},

				my_posts: {
					viewFrom: "posts",
					exclude: ["meta"],
					where: {
						"user_id": "$uid",
					}
				},

				my_profile: {
					access: "user",
					singleViewFrom: "users",
					where: {
						"id": "$uid"
					}
				}
			}
		});

		await qql.migrate({log: ()=>{}});

		let uid=await qql({insertInto: "users", set: {name: "micke"}});
		let uid2=await qql({insertInto: "users", set: {name: "micke2"}});
		await qql({insertInto: "posts", set: {title: "micke post 1", user_id: uid}});
		await qql({insertInto: "posts", set: {title: "micke post 2", user_id: uid, published: true}});
		await qql({insertInto: "posts", set: {title: "micke2 post 1", user_id: uid2, published: true}});
		await qql({insertInto: "published_posts", set: {title: "micke post 4"}});

		await qql.env({uid:2,role:"admin"}).query({insertInto: "my_posts", set: {title: "hello"}});
		let my=await qql.env({uid:2,role:"admin"}).query({manyFrom: "my_posts"});
		//console.log(my);
		expect(my.length).toEqual(2);
		//console.log(await qql({manyFrom: "posts"}));

		//await qql({insertInto: "my_posts", set: {title: "my micke post 4"}});

		//console.log(await qql({manyFrom: "posts", where: {id: 1}}));
		expect((await qql({manyFrom: "published_posts"})).length).toEqual(3);
		//console.log(await qql({manyFrom: "published_posts", select: ["published"]}));

		//console.log(await qql.env({uid:1,role: "user"}).query({oneFrom: "my_profile"}));
	})
})