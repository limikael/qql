import sqlite3 from "sqlite3";
import {qqlSqlite} from "../src/drivers.js";
import QqlRestServer from "../src/QqlRestServer.js";

describe("qql",()=>{
	it("works",async()=>{
		let qql=qqlSqlite({
			sqlite: new sqlite3.Database(':memory:'),
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
		await qql({insertInto: "users", set: {name: "micke"}});
		let id2=await qql({insertInto: "users", set: {name: "micke2"}});

		let qqlRest=new QqlRestServer(qql);
		let request,response,result;

		request=new Request("http://example.com/users");
		response=await qqlRest.handleRequest(request);
		result=await response.json();
		expect(result.length).toEqual(2);

		request=new Request("http://example.com/users/"+id2);
		response=await qqlRest.handleRequest(request);
		result=await response.json();
		expect(result.name).toEqual("micke2");

		request=new Request("http://example.com/users/",{
			method: "POST",
			body: JSON.stringify({name: "someone", another: 123})
		});
		response=await qqlRest.handleRequest(request);
		result=await response.json();
		expect(result.name).toEqual("someone");

		request=new Request("http://example.com/users");
		response=await qqlRest.handleRequest(request);
		result=await response.json();
		expect(result.length).toEqual(3);

		request=new Request("http://example.com/users/"+id2,{
			method: "PUT",
			body: JSON.stringify({name: "mickenew"})
		});
		response=await qqlRest.handleRequest(request);
		result=await response.json();
		expect(result.name).toEqual("mickenew");

		request=new Request("http://example.com/users?"+new URLSearchParams({
			filter: JSON.stringify({name: "mickenew"})
		}));
		response=await qqlRest.handleRequest(request);
		result=await response.json();
		expect(result.length).toEqual(1);

		request=new Request("http://example.com/users/"+id2,{
			method: "DELETE",
		});
		response=await qqlRest.handleRequest(request);
		result=await response.json();
		expect(result.name).toEqual("mickenew");

		request=new Request("http://example.com/users");
		response=await qqlRest.handleRequest(request);
		result=await response.json();
		expect(result.length).toEqual(2);
	});
});