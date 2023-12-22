import * as web3 from "web3"
import test from "ava"
import { dynamicAbiEncodeArgs, getAbiEncodeParametersArguments } from "@canvas-js/signed-cid"

test(`empty argument`, (t) => {
	const { types, values } = getAbiEncodeParametersArguments({})
	t.deepEqual(types, [])
	t.deepEqual(values, [])
	web3.eth.abi.encodeParameters(types, values)
})

test(`argument with a variety of valid fields`, (t) => {
	const { types, values } = getAbiEncodeParametersArguments({
		a: 1,
		b: "2",
		c: true,
		d: "0x0000000000000000000000000000000000000000",
	})
	t.deepEqual(types, ["string", "int256", "string", "string", "string", "bool", "string", "address"])
	t.deepEqual(values, ["a", 1, "b", "2", "c", true, "d", "0x0000000000000000000000000000000000000000"])
	web3.eth.abi.encodeParameters(types, values)
})

const unsupportedCases = [
	{ name: "null", value: null },
	{ name: "undefined", value: undefined },
	{ name: "array", value: [] },
	{ name: "object", value: {} },
	{ name: "function", value: () => {} },
	{ name: "float", value: 0.5 },
]

for (const { name, value } of unsupportedCases) {
	test(`throws error if passed unsupported values - ${name}`, (t) => {
		t.throws(() => {
			getAbiEncodeParametersArguments({
				a: value,
			})
		})
	})
}

test("encoded abi keys are sorted lexicographically", (t) => {
	const input = {
		c: 3,
		d: 4,
		b: 2,
		a: 1,
	}
	const { types, values } = getAbiEncodeParametersArguments(input)
	t.deepEqual(types, ["string", "int256", "string", "int256", "string", "int256", "string", "int256"])
	t.deepEqual(values, ["a", 1, "b", 2, "c", 3, "d", 4])
	web3.eth.abi.encodeParameters(types, values)
})
