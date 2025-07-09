import {describeForEachDriver} from "../support/qql-test-setup.js";
import QqlAnalysis from "../../src/qql/QqlAnalysis.js";
import {createQql} from "../../src/qql/Qql.js";

describeForEachDriver("qql analysis",(driver)=>{
	it("can get existing table names",async ()=>{
		let analysis=new QqlAnalysis({qql:{driver}});
		for (let table of await analysis.driver.describe())
			await driver.query(`DROP TABLE ${driver.escapeId(table.name)}`,[]);

		await driver.query("CREATE TABLE hello (val INTEGER NOT NULL)",[]);
		await driver.query("CREATE TABLE helloagain (val INTEGER NOT NULL)",[]);

		let tables=await analysis.driver.describe();
		expect(tables.map(t=>t.name)).toEqual(["hello","helloagain"]);

		for (let table of await driver.describe())
			await driver.query(`DROP TABLE ${driver.escapeId(table.name)}`,[]);

		tables=await analysis.driver.describe();
		expect(tables).toEqual([]);
	});

	it("can get table columns",async ()=>{
		let analysis=new QqlAnalysis({qql:{driver}});

		await driver.query("CREATE TABLE hello (id integer not null primary key, val INTEGER NOT NULL, val2 BOOLEAN DEFAULT true)",[]);
		await driver.query("CREATE TABLE hello2 (id integer not null primary key, otherval INTEGER NOT NULL)",[]);
		let describe=await driver.describe();
		//console.log(JSON.stringify(describe));

		expect(describe).toEqual([
			{"name":"hello","fields":[
				{"name":"id","notnull":true,"type":"integer","pk":true,"defaultSql":null},
				{"name":"val","notnull":true,"type":"integer","pk":false,"defaultSql":null},
				{"name":"val2","notnull":false,"type":"boolean","pk":false,"defaultSql":"true"}
			]},
			{"name":"hello2","fields":[
				{"name":"id","notnull":true,"type":"integer","pk":true,"defaultSql":null},
				{"name":"otherval","notnull":true,"type":"integer","pk":false,"defaultSql":null}
			]}
		]);
	});

	it("can analyze",async ()=>{
		let qql=createQql({
			driver,
			tables: {
				hello: {
					fields: {
						id: {type: "integer", pk: true},
						val: {type: "integer"},
						val2: {type: "integer"},
					}
				}
			}
		});

		//await dropExisting(qql);

		let analysis=await qql.analyze();
		let migrationQueries=analysis.getMigrationQueries();
		//console.log(migrationQueries);
		await qql.runQueries(migrationQueries,"none");

		let helloId1=await qql({insertInto: "hello",set: {val: 1, val2: 2}});
		let helloId2=await qql({insertInto: "hello",set: {val: 11, val2: 22}});
		expect([helloId1,helloId2]).toEqual([1,2]);

		qql=createQql({
			driver,
			tables: {
				hello: {
					fields: {
						id: {type: "integer", pk: true},
						val: {type: "integer"},
						val2: {type: "integer"},
						val3: {type: "integer"}
					}
				}
			}
		});

		analysis=await qql.analyze();
		migrationQueries=analysis.getMigrationQueries();
		//console.log(migrationQueries);
		await qql.runQueries(migrationQueries,"none");
	});
});