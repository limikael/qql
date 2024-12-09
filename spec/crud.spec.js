import sqlite3 from "sqlite3";
import {createQql} from "../src/qql/Qql.js";
import QqlDriverSqlite from "../src/drivers/QqlDriverSqlite.js";

describe("qql crud",()=>{
	it("insert and select",async()=>{
		let qql=createQql({
			driver: new QqlDriverSqlite(new sqlite3.Database(':memory:')),
			tables: {
				users: {
					fields: {
						id: {type: "integer", pk: true, notnull: true},
						name: {type: "text"},
					}
				},
			}
		});

		/*console.log(qql.tables["users"].fields["name"].createWhereExpression("micke","="));
		console.log(qql.tables["users"].fields["name"].createWhereExpression(["micke","test"],"="));
		console.log(qql.tables["users"].fields["name"].createWhereExpression("micke","~"));*/

		await qql.migrate({log: ()=>{}});
		await qql.migrate({log: ()=>{}});

		await qql({insertInto: "users", set: {name: "micke"}});
		await qql({insertInto: "users", set: {name: "micke2"}});

		let res;
		res=await qql({manyFrom: "users", where: {name: "micke"}});
		expect(res).toEqual([ { id: 1, name: 'micke' } ]);
		//console.log(res);

		res=await qql({manyFrom: "users"});
		expect(res).toEqual([ { id: 1, name: 'micke' }, { id: 2, name: 'micke2' } ]);
		//console.log(res);

		res=await qql({manyFrom: "users", where: {"name~": "ICKE2"}});
		expect(res).toEqual([ { id: 2, name: 'micke2' } ]);
		//console.log(res);
	});

	it("insert, select update delete",async()=>{
		let qql=createQql({
			driver: new QqlDriverSqlite(new sqlite3.Database(':memory:')),
			tables: {
				users: {
					fields: {
						id: {type: "integer", pk: true, notnull: true},
						name: {type: "text"},
						other: {type: "text"}
					}
				},
			}
		});

		await qql.migrate({log: ()=>{}});

		await qql({insertInto: "users", set: {name: "micke"}});
		await qql({insertInto: "users", set: {name: "micke2"}});
		await qql({insertInto: "users", set: {name: "micke3"}});

		await qql({deleteFrom: "users", where: {name: "micke3"}});
		expect((await qql({manyFrom: "users"})).length).toEqual(2);

		await qql({update: "users", set: {name: "blabla", other: "123"}, where: {name: "micke"}});

		let res;
		res=await qql({manyFrom: "users", where: {"name~": "MICKE"}});
		//console.log(res);
		expect(res.length).toEqual(1);

		res=await qql({manyFrom: "users"});
		expect(res.length).toEqual(2);

	});
});