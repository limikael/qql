import {canonicalizeJoins, canonicalizeSort} from "../src/lib/qql-util.js";

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

	it("can canonicalize sort",()=>{
		expect(
			canonicalizeSort("hello")
		).toEqual(
			{"hello":"asc"}
		);

		expect(
			canonicalizeSort(["hello","asc"])
		).toEqual(
			{"hello":"asc"}
		);

		expect(
			canonicalizeSort([["hello","asc"],["bla","DESC"]])
		).toEqual(
			{"hello":"asc","bla":"desc"}
		);

		expect(canonicalizeSort()).toEqual({});
		expect(canonicalizeSort({
			hello: "ASC",
			world: "DESC"
		})).toEqual({
			hello: "asc",
			world: "desc"
		});
	})
})