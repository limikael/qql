import {describeForEachDriver} from "../support/qql-test-setup.js";
import QqlAnalysis from "../../src/qql/QqlAnalysis.js";
import {createQql} from "../../src/qql/Qql.js";

describeForEachDriver("qql",(driver)=>{
	it("can get existing table names",async ()=>{
		let analysis=new QqlAnalysis({qql:{driver}});
		for (let tableName of await analysis.getTableNames())
			await driver.query(`DROP TABLE ${driver.escapeId(tableName)}`,[]);

		await driver.query("CREATE TABLE hello (val INTEGER NOT NULL)",[]);
		await driver.query("CREATE TABLE helloagain (val INTEGER NOT NULL)",[]);

		let tableNames=await analysis.getTableNames();
		expect(tableNames).toEqual(["hello","helloagain"]);

		for (let tableName of await analysis.getTableNames())
			await driver.query(`DROP TABLE ${driver.escapeId(tableName)}`,[]);

		tableNames=await analysis.getTableNames();
		expect(tableNames).toEqual([]);
	});

	it("can get table columns",async ()=>{
		let analysis=new QqlAnalysis({qql:{driver}});
		for (let tableName of await analysis.getTableNames())
			await driver.query(`DROP TABLE ${driver.escapeId(tableName)}`,[]);

		await driver.query("CREATE TABLE hello (id integer not null primary key, val INTEGER NOT NULL, val2 INTEGER)",[]);
		let describeRows=await driver.getDescribeRows("hello");
		expect(describeRows).toEqual([
		  {
		    name: 'id',
		    notnull: true,
		    type: 'integer',
		    pk: true,
		    defaultSql: null
		  },
		  {
		    name: 'val',
		    notnull: true,
		    type: 'integer',
		    pk: false,
		    defaultSql: null
		  },
		  {
		    name: 'val2',
		    notnull: false,
		    type: 'integer',
		    pk: false,
		    defaultSql: null
		  }
		]);

		//console.log(describeRows);
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