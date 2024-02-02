import test from "ava"
import { AbiCoder } from "ethers/abi"
import { getEIP712Args } from "@canvas-js/signed-cid"

test(`empty argument`, (t) => {
	const { types, values } = getEIP712Args({})
	t.deepEqual(types, [])
	t.deepEqual(values, [])
	new AbiCoder().encode(types, values)
})

test(`argument with a variety of valid fields`, (t) => {
	const { types, values } = getEIP712Args({
		a: 1,
		b: -1,
		c: "2",
		d: true,
		e: "0x0000000000000000000000000000000000000000",
	})
	t.deepEqual(types, ["int256", "int256", "string", "bool", "address"])
	t.deepEqual(values, [1, -1, "2", true, "0x0000000000000000000000000000000000000000"])
	new AbiCoder().encode(types, values)
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
			getEIP712Args({
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
	const { types, values } = getEIP712Args(input)
	t.deepEqual(types, ["int256", "int256", "int256", "int256"])
	t.deepEqual(values, [1, 2, 3, 4])
	new AbiCoder().encode(types, values)
})
