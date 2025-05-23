import sqlite3 from "sqlite3";
import {createQql} from "../src/qql/Qql.js";
import QqlDriverSqlite from "../src/drivers/QqlDriverSqlite.js";

/*describe("qql single view",()=>{
	it("works",async()=>{
		let qql=createQql({
			driver: new QqlDriverSqlite(new sqlite3.Database(':memory:')),
			tables: {
				users: {
					fields: {
						id: {type: "integer", pk: true, notnull: true},
						name: {type: "text"},
					}
				},

				pages: {
					fields: {
						id: {type: "integer", pk: true, notnull: true},
						slug: {type: "text"},
						content: {type: "text"},
						num: {type: "integer", default: 123},
						othernum: {type: "integer", default: 888},
						user_id: {type: "reference", reference: "users"},
					},
					policies: [
						{roles: "user", where:{user_id: "$uid"}}
					]
				},

				about_me: {
					singleViewFrom: "pages",
					where: {
						slug: "about",
						user_id: "$uid"
					}
				}
			}
		});

		let item;

		await qql.migrate({log: ()=>{}});
		item=await qql.env({uid: 1, role: "user"}).query({oneFrom: "about_me"});
		//console.log(item);

		await qql.env({uid: 1, role: "user"}).query({update: "about_me", set: {content: "hello"}});
		item=await qql.env({uid: 1, role: "user"}).query({oneFrom: "about_me"});
		//console.log(item);

		await qql.env({uid: 1, role: "user"}).query({update: "about_me", set: {content: "hello2"}});
		item=await qql.env({uid: 1, role: "user"}).query({oneFrom: "about_me"});
		//console.log(item);
		expect(item).toEqual({ id: 1, content: 'hello2', num: 123, othernum: 888 });

		// ???
		//await qql.env({uid: 1, role: "user"}).query({update: "about_me", set: {content: "hello5"}, where: {num: 5}});
		//item=await qql.env({uid: 1, role: "user"}).query({oneFrom: "about_me", where: {num: 5}});
		//console.log(item);
		//expect(item).toEqual({ id: 2, content: 'hello5', num: 5, othernum: 888 });
		//expect(item).toEqual(null);

		//console.log(await qql({manyFrom: "pages"}));
		item=await qql.env({uid: 1, role: "user"}).query({oneFrom: "about_me", where: {num: 777}});
		//console.log(item);
	})
});*/