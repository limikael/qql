import sqlite3 from "sqlite3";
import {createQql} from "../src/Qql.js";
import {qqlDriverSqlite} from "../src/drivers.js";

describe("sorting",()=>{
	it("works",async()=>{
		let qql=createQql({
			driver: qqlDriverSqlite(new sqlite3.Database(':memory:')),
			tables: {
				posts: {
					fields: {
						id: {type: "integer", pk: true, notnull: true},
						published: {type: "date"},
					}
				},
			}
		});

		await qql.migrate({log: ()=>{}});
		await qql({insertInto: "posts", set: {published: "2024-04-06"}});
		await qql({insertInto: "posts", set: {published: "2024-04-05"}});

		expect(await qql({manyFrom: "posts", sort: ["published","DESC"]}))
			.toEqual([
				{ id: 1, published: '2024-04-06' },
				{ id: 2, published: '2024-04-05' },
			]);

		expect(await qql({manyFrom: "posts", sort: ["published","ASC"]}))
			.toEqual([
				{ id: 2, published: '2024-04-05' },
				{ id: 1, published: '2024-04-06' },
			]);

		expect(await qql({manyFrom: "posts", sort: "published"}))
			.toEqual([
				{ id: 2, published: '2024-04-05' },
				{ id: 1, published: '2024-04-06' },
			]);
	});
});