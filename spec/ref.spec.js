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
						about_id: {type: "reference", reference: "posts", prop: "about", refprop: "aboutuser"}
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

		await qql.migrate();

		let userId=await qql.query({insertInto: "users", set: {name: "micke"}, return: "id"});
		await qql.query({insertInto: "posts", set: {id: 1, title: "post 1", user_id: userId}});
		await qql.query({insertInto: "posts", set: {id: 2, title: "post 2", user_id: userId}});

		//console.log(await qql.query({oneFrom: "users", join: ["posts"]}));
		//console.log(await qql.query({oneFrom: "posts", join: ["users"]}));
	})
});