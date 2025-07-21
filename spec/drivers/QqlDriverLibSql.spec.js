import QqlDriverLibSql from "../../src/drivers/QqlDriverLibSql.js";
import {createClient}from "@libsql/client";
import path from "node:path";
import {fileURLToPath} from 'url';
import fs, {promises as fsp} from "fs";

const __dirname=path.dirname(fileURLToPath(import.meta.url));

describe("QqlDriverLibSql",()=>{
	it("works",async ()=>{
		let dbFileName=path.join(__dirname,"test.db");
		await fsp.rm(dbFileName,{force: true});

		let driver=new QqlDriverLibSql({client: createClient({url: "file::memory:"})})

		await driver.query("CREATE TABLE test (col1 INTEGER, col2 INTEGER)",[]);
		let val=await driver.query("INSERT INTO test (col1,col2) VALUES (?,?),(?,?)",[1,2,3,4],"id");
		expect(val).toEqual(2);

		let res=await driver.query("SELECT * FROM test",[],"rows");
		//console.log(res);
		expect(res).toEqual([ { col1: 1, col2: 2 }, { col1: 3, col2: 4 } ]);

		await driver.query("SELECT * FROM test",[],"changes");
		await driver.query("INSERT INTO test (col1,col2) VALUES (?,?),(?,?)",[1,2,3,4],"rows");
	});
});
