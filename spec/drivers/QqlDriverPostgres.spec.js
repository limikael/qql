import QqlDriverPostgres from "../../src/drivers/QqlDriverPostgres.js";
import pg from 'pg';
import path from "node:path";
import {fileURLToPath} from 'url';
import fs, {promises as fsp} from "fs";

const __dirname=path.dirname(fileURLToPath(import.meta.url));

describe("QqlDriverPostgres",()=>{
	it("works",async ()=>{
		/*let DATABASE_URL="postgresql://micke:getter@localhost/test";
		const pool = new pg.Pool({
			connectionString: DATABASE_URL,
		});

		let driver=new QqlDriverPostgres({pool: pool});

		await driver.query("DROP TABLE IF EXISTS test");
		await driver.query("CREATE TABLE test (col1 INTEGER, col2 INTEGER)");
		await driver.query("INSERT INTO test (col1,col2) VALUES (?,?),(?,?)",[1,2,3,4]);
		let res=await driver.query("SELECT * FROM test",[],"rows");
		//console.log(res);
		expect(res).toEqual([ { col1: 1, col2: 2 }, { col1: 3, col2: 4 } ]);*/
	});
});