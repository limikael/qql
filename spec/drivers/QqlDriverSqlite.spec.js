import QqlDriverSqlite from "../../src/drivers/QqlDriverSqlite.js";
import sqlite3 from "sqlite3";
import path from "node:path";
import {fileURLToPath} from 'url';
import fs, {promises as fsp} from "fs";

const __dirname=path.dirname(fileURLToPath(import.meta.url));

describe("QqlDriverSqlite",()=>{
	it("works",async ()=>{
		let dbFileName=path.join(__dirname,"test.db");
		await fsp.rm(dbFileName,{force: true});

		let driver=new QqlDriverSqlite(new sqlite3.Database(dbFileName));

		await driver.query("CREATE TABLE test (col1 INTEGER, col2 INTEGER)");
		await driver.query("INSERT INTO test (col1,col2) VALUES (?,?),(?,?)",[1,2,3,4]);
		let res=await driver.query("SELECT * FROM test",[],"rows");
		//console.log(res);
		expect(res).toEqual([ { col1: 1, col2: 2 }, { col1: 3, col2: 4 } ]);
	});
});