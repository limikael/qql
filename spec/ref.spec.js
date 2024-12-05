import sqlite3 from "sqlite3";
import {createQql} from "../src/qql/Qql.js";
import QqlDriverSqlite from "../src/drivers/QqlDriverSqlite.js";

describe("qql ref",()=>{
	it("basic",async()=>{
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
					}
				},
			}
		});

		await qql.migrate({log: ()=>{}});

		let userId=await qql.query({insertInto: "users", set: {name: "micke"}, return: "id"});
		await qql.query({insertInto: "posts", set: {title: "post 1", user_id: userId}});
		await qql.query({insertInto: "posts", set: {title: "post 2", user_id: userId}});

		let user2Id=await qql.query({insertInto: "users", set: {name: "micke2"}, return: "id"});
		await qql.query({insertInto: "posts", set: {title: "post 3", user_id: user2Id}});

		let usersIncludingPosts=await qql.query({
			manyFrom: "users", 
			include: {
				posts: {manyFrom: "posts"}
			}
		});

		//console.log(JSON.stringify(usersIncludingPosts,null,2));
		expect(usersIncludingPosts.length).toEqual(2);
		expect(usersIncludingPosts[0].posts.length).toEqual(2);
		expect(usersIncludingPosts[1].posts.length).toEqual(1);

		let postsIncludingUsers=await qql.query({
			manyFrom: "posts",
			include: {
				user: {oneFrom: "users"}
			}
		});

		//console.log(postsIncludingUsers);
		expect(postsIncludingUsers.length).toEqual(3);
		expect(postsIncludingUsers[0].user.name).toEqual("micke");
		expect(postsIncludingUsers[1].user.name).toEqual("micke");
		expect(postsIncludingUsers[2].user.name).toEqual("micke2");
	});

	it("works",async()=>{
		let qql=createQql({
			driver: new QqlDriverSqlite(new sqlite3.Database(':memory:')),
			tables: {
				users: {
					fields: {
						id: {type: "integer", pk: true, notnull: true},
						name: {type: "text"},
						about_id: {type: "reference", reference: "posts"}
					}
				},

				posts: {
					fields: {
						id: {type: "integer", pk: true, notnull: true},
						title: {type: "text"},
						user_id: {type: "reference", reference: "users"},
					}
				},
			}
		});

		await qql.migrate({log: ()=>{}});

		let userId=await qql.query({insertInto: "users", set: {name: "micke"}, return: "id"});
		await qql.query({insertInto: "posts", set: {id: 1, title: "post 1", user_id: userId}});
		await qql.query({insertInto: "posts", set: {id: 2, title: "post 2", user_id: userId}});

		//console.log(await qql.query({oneFrom: "users", include: {posts: {manyFrom: "posts"}}}));
		//console.log(await qql.query({oneFrom: "posts", include: {user: {oneFrom: "users"}}}));
	})
});