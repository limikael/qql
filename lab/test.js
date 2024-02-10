import {qqlGeneric, qqlSqlite, qqlSqljs} from "../src/drivers.js";
import sqlite3 from "sqlite3";

let db=new sqlite3.Database("attic/test.sqlite")

let qql=qqlSqlite(db,{
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
				author: {type: "reference", reference: "users"/*, refprop: "authored"*/},
				proofreader: {type: "reference", reference: "users", refprop: "proofread"}
			}
		},
	}
});

await qql.migrate();

await qql({insertInto: "users", set: {name: "micke"}});
console.log(await qql({manyFrom: "users"}));
await qql({deleteFrom: "users"});
