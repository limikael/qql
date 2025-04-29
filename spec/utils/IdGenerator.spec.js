import IdGenerator from "../../src/utils/IdGenerator.js";

describe("id generator",()=>{
	it("can generate ids",()=>{
		let idGenerator=new IdGenerator();
		expect(idGenerator.pick()).toEqual(1);
		expect(idGenerator.pick()).toEqual(2);
	});
});