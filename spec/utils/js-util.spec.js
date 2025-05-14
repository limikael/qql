import {arrayChunkify} from "../../src/utils/js-util.js";

describe("js-util",()=>{
	it("can chunkify an array",()=>{
		let a=[1,2,3,4,5,6,7,8];
		let chunks=arrayChunkify(a,3);
		expect(chunks).toEqual([[1,2,3],[4,5,6],[7,8]]);
	});
})