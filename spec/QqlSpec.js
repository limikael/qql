import {sqljsNew,sqljsCreateRunner} from "./sqljs-util.js";
import Qql from "../src/Qql.js";

describe("qql",()=>{
	it("works",async()=>{
		let db=await sqljsNew();

		let qql=new Qql({
			driver: sqljsCreateRunner(db),
			tables: {
				users: {
					fields: {
						id: {type: "integer", pk: true, notnull: true},
						name: {type: "text"},
						num: {type: "integer"},
						test: {type: "json"},
						another: {type: "text"}
					}
				}
			}
		});

		await qql.migrate();

		let query=qql.query;

		await query({insertInto: "users", set: {name: "micke"}});
		await query({insertInto: "users", set: {name: "micke2"}});

		let a;

		a=await query({manyFrom: "users"});
		expect(a.length).toEqual(2);
		a=await query({manyFrom: "users", where: {name: "micke"}});
		expect(a.length).toEqual(1);
		expect(a[0].name).toEqual("micke");

		await query({update: "users", set: {name: "micke3"}, where: {name: "micke2"}});

		await query({deleteFrom: "users", where: {name: "micke"}});
		a=await query({manyFrom: "users"});
		expect(a.length).toEqual(1);
		expect(a[0].name).toEqual("micke3");

		a=await query({oneFrom: "users"});
		expect(a.name).toEqual("micke3");
	})
})