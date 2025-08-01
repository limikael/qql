import {qqlHydrateQuery} from "../../src/lib/qql-hydrate.js";
import {createQql} from "../../src/qql/Qql.js";
import QqlDriverSqlite from "../../src/drivers/QqlDriverSqlite.js";
import sqlite3 from "sqlite3";

describe("qql-hydrate",()=>{
	let qql;

	beforeEach(async ()=>{
		qql=createQql({
			driver: new QqlDriverSqlite(new sqlite3.Database(":memory:")),
			tables: {
				experiences: {
					fields: {
						id: {type: "integer", pk: true, notnull: true},
						name: {type: "text"},
						description: {type: "text"},
						venue_id: {reference: "venues"}
					}
				},
				addons: {
					fields: {
						id: {type: "integer", pk: true, notnull: true},
						experience_id: {type: "reference", reference: "experiences"},
						name: {type: "text"},
					}
				},
				addon_options: {
					fields: {
						id: {type: "integer", pk: true, notnull: true},
						addon_id: {type: "reference", reference: "addons"},
						name: {type: "text"},
					}
				},
				venues: {
					fields: {
						id: {type: "integer", pk: true, notnull: true},
						name: {type: "text"},
					}
				}
			}
		});

		await qql.migrate({log: ()=>{}});
	});

	it("can fetch an item",async ()=>{
		//let qql=await quickminCreateTestQql("quickmin.yaml");

		await qql({insertInto: "experiences", set: {id: 1, name: "My Experience 1"}});
		await qql({insertInto: "experiences", set: {id: 2, name: "My Experience 2"}});
		await qql({insertInto: "experiences", set: {id: 3, name: "My Experience 3"}});

		/*await qql({insertInto: "addons", set: {id: 1, experience_id: 1, name: "addon 1"}});
		await qql({insertInto: "addons", set: {id: 2, experience_id: 1, name: "addon 2"}});*/

		let exp=await qqlHydrateQuery({
			qql: qql,
			oneFrom: "experiences",
			where: {id:2}
		});

		exp.name="test";
		await exp.save();

		let after=await qql({manyFrom: "experiences"});
		//console.log(after);
		expect(after[1].name).toEqual("test");
	});

	it("can fetch a list",async ()=>{
		//let qql=await quickminCreateTestQql("quickmin.yaml");

		await qql({insertInto: "experiences", set: {id: 1, name: "My Experience 1"}});
		await qql({insertInto: "experiences", set: {id: 2, name: "My Experience 2"}});
		await qql({insertInto: "experiences", set: {id: 3, name: "My Experience 3"}});

		await qql({insertInto: "addons", set: {id: 1, experience_id: 1, name: "addon 1"}});
		await qql({insertInto: "addons", set: {id: 2, experience_id: 1, name: "addon 2"}});

		let data=await qqlHydrateQuery({
			qql: qql,
			manyFrom: "experiences",
			include: {
				addons: {manyFrom: "addons", via: "experience_id"}
			}
		});

		//console.log(data);
		expect(data[0].name).toEqual("My Experience 1");

		//console.log(dataList.value);

		data[0].description="hello";
		await data[0].save();

		//console.log(await qql({manyFrom: "experiences"}));

		expect(await qql({select: ["description"], oneFrom: "experiences", where: {id: 1}})).toEqual({description: "hello"});

		expect(data[0].addons[0].name).toEqual("addon 1");
		data[0].addons[0].name="changed addon name";
		await data[0].addons[0].save();

		expect(await qql({select: ["name"], oneFrom: "addons", where: {id: 1}})).toEqual({name:"changed addon name"});
	});

	it("can create an item",async ()=>{
		//let qql=await quickminCreateTestQql("quickmin.yaml");

		await qql({insertInto: "experiences", set: {id: 1, name: "My Experience 1"}});

		let data=await qqlHydrateQuery({
			qql: qql, 
			manyFrom: "experiences"
		});

		let exp=data.new();

		exp.name="hello";
		await exp.save();

		exp.name="hello2";
		await exp.save();

		//console.log(await qql({select: ["name"], manyFrom: "experiences"}));
		expect(await qql({select: ["name"], manyFrom: "experiences"})).toEqual([{name: "My Experience 1"},{name: "hello2"}]);

		expect(data.length).toEqual(2);
	});

	it("can create a sub item",async ()=>{
		//let qql=await quickminCreateTestQql("quickmin.yaml");

		await qql({insertInto: "experiences", set: {id: 1, name: "My Experience 1"}});
		await qql({insertInto: "experiences", set: {id: 2, name: "My Experience 2"}});
		await qql({insertInto: "experiences", set: {id: 3, name: "My Experience 3"}});

		await qql({insertInto: "addons", set: {id: 1, experience_id: 1, name: "addon 1"}});
		await qql({insertInto: "addons", set: {id: 2, experience_id: 1, name: "addon 2"}});

		await qql({insertInto: "addon_options", set: {id: 7, addon_id: 1, name: "addon option 1"}});
		await qql({insertInto: "addon_options", set: {id: 8, addon_id: 1, name: "addon option 2"}});

		let data=await qqlHydrateQuery({
			qql: qql, 
			manyFrom: "experiences",
			include: {
				addons: {manyFrom: "addons", via: "experience_id", include: {
					addon_options: {manyFrom: "addon_options", via: "addon_id"}
				}}
			}
		});

		//console.log(JSON.stringify(data,null,2));

		let firstNewAddon=data[0].addons.new();
		firstNewAddon.name="first new addon";
		await firstNewAddon.save();

		let secondNewAddon=data[1].addons.new();
		secondNewAddon.name="second new addon";
		await secondNewAddon.save();

		//console.log(await qql({manyFrom: "addons"}));
		expect((await qql({manyFrom: "addons"})).length).toEqual(4);

		let newAddon=data[0].addons.new();
		newAddon.name="new addon";

		let newAddonOption=newAddon.addon_options.new();
		newAddonOption.name="new addon option";
		await newAddonOption.save();

		await newAddon.save();
		//console.log(JSON.stringify(data,null,2));

		let newData=await qql({
			manyFrom: "experiences",
			include: {
				addons: {manyFrom: "addons", via: "experience_id", include: {
					addon_options: {manyFrom: "addon_options", via: "addon_id"}
				}}
			}
		});

		//console.log(JSON.stringify(newData,null,2));
		expect(newData[0].addons[3].name).toEqual("new addon");
		expect(newData[0].addons[3].addon_options[0].name).toEqual("new addon option");

		//console.log(await qql({manyFrom: "experiences", include: {addons: {manyFrom: "addons"}}}));
		//console.log(await qql({manyFrom: "addon_options"}));
	});

	it("can delete",async ()=>{
		//let qql=await quickminCreateTestQql("quickmin.yaml");

		await qql({insertInto: "experiences", set: {id: 1, name: "My Experience 1"}});
		await qql({insertInto: "experiences", set: {id: 2, name: "My Experience 2"}});
		await qql({insertInto: "experiences", set: {id: 3, name: "My Experience 3"}});

		await qql({insertInto: "addons", set: {id: 1, experience_id: 1, name: "addon 1"}});
		await qql({insertInto: "addons", set: {id: 2, experience_id: 1, name: "addon 2"}});

		let data=await qqlHydrateQuery({
			qql: qql,
			manyFrom: "experiences",
			include: {
				addons: {manyFrom: "addons", via: "experience_id"}
			}
		});

		await data[0].addons[1].delete();

		expect(data[0].addons.length).toEqual(1);

		expect((await qql({manyFrom: "addons"})).length).toEqual(1);
	});

	it("works with oneFrom",async ()=>{
		//let qql=await quickminCreateTestQql("quickmin.yaml");

		await qql({insertInto: "venues", set: {id: 123, name: "the venue"}});

		await qql({insertInto: "experiences", set: {id: 1, name: "My Experience 1"}});
		await qql({insertInto: "experiences", set: {id: 2, name: "My Experience 2", venue_id: 123}});
		await qql({insertInto: "experiences", set: {id: 3, name: "My Experience 3"}});

		await qql({insertInto: "addons", set: {id: 1, experience_id: 1, name: "addon 1"}});
		await qql({insertInto: "addons", set: {id: 2, experience_id: 1, name: "addon 2"}});

		let add=await qqlHydrateQuery({
			qql: qql,
			oneFrom: "addons",
			include: {
				"experience": {oneFrom: "experiences"}
			}
		});

		//console.log(add.experience);
		add.experience.name="changed name";
		await add.experience.save();

		let exp;
		exp=await qqlHydrateQuery({
			qql: qql,
			oneFrom: "experiences", 
			where: {id: 2},
			include: {
				"venue": {oneFrom: "venues"}
			}
		});
		expect(exp.name).toEqual("My Experience 2");
		expect(exp.venue.name).toEqual("the venue");

		exp=await qqlHydrateQuery({
			qql: qql,
			oneFrom: "experiences", 
			where: {id: 1},
			include: {
				"venue": {oneFrom: "venues"}
			}
		});
		expect(exp.name).toEqual("changed name");
	});
});
