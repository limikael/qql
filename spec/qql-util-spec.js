import {canonicalizeJoins} from "../src/qql-util.js";

describe("qql-util",()=>{
	it("can canonicalize joins",()=>{
		expect(
			canonicalizeJoins("hello")
		).toEqual(
			[ { join: 'hello' } ]
		);

		expect(
			canonicalizeJoins(["hello","world"])
		).toEqual(
			[ { join: 'hello' }, { join: 'world' } ]
		);

		expect(
			canonicalizeJoins(["hello",{join: "world", where: {x:5}}])
		).toEqual(
			[ { join: 'hello' }, { join: 'world', where: { x: 5 } } ]
		);

		expect(canonicalizeJoins({
			hello: {},
			world: {where: {x:5}}
		})).toEqual(
			[ { join: 'hello' }, { join: 'world', where: { x: 5 } } ]
		);
	})
})