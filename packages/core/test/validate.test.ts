// tests for checking whether specs are valid

import test from "ava"
import { VM } from "@canvas-js/core"
import { EthereumBlockProvider } from "@canvas-js/verifiers"

const success = {
	valid: true,
	errors: [],
	warnings: [],
}

const errors = (e: any) => ({
	valid: false,
	errors: e,
	warnings: [],
})

const warnings = (w: any) => ({
	valid: true,
	errors: [],
	warnings: w,
})

const VALIDATION_TEST_FIXTURES: {
	name: string
	spec: string
	expectedResult: Awaited<ReturnType<typeof VM.validateWithoutCreating>>
}[] = [
	{
		name: "reject a blank spec",
		spec: "",
		expectedResult: errors(["Spec is missing `models` export", "Spec is missing `actions` export"]),
	},
	{
		name: "reject a syntactically invalid spec",
		spec: "SAD!@$£WTEGJSWO£W$",
		expectedResult: errors(['Syntax error: Unexpected token, expected ";" (1:4)']),
	},
	{
		name: "accept a minimal spec",
		spec: `
      export const models = {};
      export const actions = {};
    `,
		expectedResult: success,
	},
	{
		name: "accept a spec with empty optional exports",
		spec: `
		  export const models = {};
			export const actions = {};
			export const contracts = {};
			export const routes = {};
			export const sources = {};
		`,
		expectedResult: success,
	},
	{
		name: "accept a spec with extraneous exports, with warning",
		spec: `
      export const models = {};
      export const actions = {};
      export const foobar = {};
      export const whatever = {};
    `,
		expectedResult: warnings(['Warning: extraneous export "foobar"', 'Warning: extraneous export "whatever"']),
	},
	{
		name: "reject invalid model name",
		spec: `
      export const models = {
        _Something: {}
      }
      export const actions = {}
    `,
		expectedResult: errors(["Model name _Something is invalid: model names must match /^[a-z][a-z_]*$/"]),
	},
	{
		name: "accept model",
		spec: `
      export const models = {
        thing: {
          id: "string",
          updated_at: "datetime"
        }
      }
      export const actions = {}
    `,
		expectedResult: success,
	},
	{
		name: "accept model with valid indexes",
		spec: `
      export const models = {
        thing: {
          id: "string",
          updated_at: "datetime",
          something: "string",
          indexes: ["something"]
        }
      }
      export const actions = {}
    `,
		expectedResult: success,
	},
	{
		name: "reject model with invalid type indexes",
		spec: `
      export const models = {
        thing: {
          id: "string",
          updated_at: "datetime",
          indexes: [1]
        }
      }
      export const actions = {}
    `,
		expectedResult: errors(["Index is invalid: 1 is not a string or a list of strings"]),
	},
	{
		name: "reject model with 'id' index",
		spec: `
      export const models = {
        thing: {
          id: "string",
          updated_at: "datetime",
          indexes: ["id"]
        }
      }
      export const actions = {}
    `,
		expectedResult: errors(['Index is invalid: "id" is already an index by default']),
	},
	{
		name: "reject model with index for field that doesn't exist",
		spec: `
      export const models = {
        thing: {
          id: "string",
          updated_at: "datetime",
          indexes: ["whatever"]
        }
      }
      export const actions = {}
    `,
		expectedResult: errors(['Index is invalid: "whatever" is not a field on model "thing"']),
	},
	{
		name: "reject model with missing properties",
		spec: `
      export const models = {
        thing: {}
      }
      export const actions = {}
    `,
		expectedResult: errors([
			"Model 'thing' is invalid: there is no 'id' field",
			"Model 'thing' is invalid: there is no 'updated_at' field",
		]),
	},
	{
		name: "reject model where id and updated_at are wrong type",
		spec: `
      export const models = {
        thing: {
          id: "number",
          updated_at: "number",
        }
      }
      export const actions = {}
    `,
		expectedResult: errors([
			"Model 'thing' is invalid: 'id' field should be 'string', but is the wrong type number",
			"Model 'thing' is invalid: 'updated_at' field should be 'datetime', but is the wrong type number",
		]),
	},
	{
		name: "reject model where extra fields have invalid type names",
		spec: `
      export const models = {
        thing: {
          id: "string",
          updated_at: "datetime",
          something: "whatever"
        }
      }
      export const actions = {}
    `,
		expectedResult: errors(["Model 'thing' is invalid: 'something' field has an invalid type ('whatever')"]),
	},
	{
		name: "reject model where extra fields have invalid names",
		spec: `
      export const models = {
        thing: {
          id: "string",
          updated_at: "datetime",
          _Hello: "string"
        }
      }
      export const actions = {}
    `,
		expectedResult: errors(["Model property _Hello is invalid: model properties must match /^[a-z][a-z_]*$/"]),
	},
	{
		name: "accept valid action",
		spec: `
      export const models = {};
      export const actions = {
        doThing({}, {}) {

        }
      }
    `,
		expectedResult: success,
	},
	{
		name: "reject actions not defined as an object",
		spec: `
      export const models = {};
      export const actions = "not an object";
    `,
		expectedResult: errors(["`actions` export must be an object"]),
	},
	{
		name: "reject action with invalid name",
		spec: `
      export const models = {};
      export const actions = {
        _doThing({}, {}) {

        }
      }
    `,
		expectedResult: errors(["Action _doThing is invalid: action names must match /^[a-zA-Z]+$/"]),
	},
	{
		name: "reject action not defined as a function",
		spec: `
      export const models = {};
      export const actions = {
        doThing: 1234
      }
    `,
		expectedResult: errors(["Action doThing is invalid: actions.doThing is not a function"]),
	},
	{
		name: "reject contracts not defined as an object",
		spec: `
      export const models = {};
      export const actions = {};
      export const contracts = 123456;
    `,
		expectedResult: errors(["`contracts` export must be an object"]),
	},
	{
		name: "accept valid contract",
		spec: `
      export const models = {};
      export const actions = {};
      export const contracts = {
        milady: {
          chain: "eth",
          chainId: 1,
          address: "0x5af0d9827e0c53e4799bb226655a1de152a425a5",
          abi: ["function balanceOf(address owner) view returns (uint balance)"],
        },
      };
    `,
		expectedResult: success,
	},
	{
		name: "reject contract if chain not supported",
		spec: `
      export const models = {};
      export const actions = {};
      export const contracts = {
        milady: {
          chain: "eth",
          chainId: 5,
          address: "0x5af0d9827e0c53e4799bb226655a1de152a425a5",
          abi: ["function balanceOf(address owner) view returns (uint balance)"],
        },
      };
    `,
		expectedResult: errors(["Contract milady is invalid: spec requires an RPC endpoint for eth:5"]),
	},
	{
		name: "reject routes if not object",
		spec: `
      export const models = {};
      export const actions = {};
      export const routes = 123456;
    `,
		expectedResult: errors(["`routes` export must be an object"]),
	},
	{
		name: "reject routes with invalid name",
		spec: `
      export const models = {};
      export const actions = {};
      export const routes = {
        _Invalid: () => {}
      };
    `,
		expectedResult: errors(["Route _Invalid is invalid: the name must match the regex /^(\\/:?[a-z_]+)+$/"]),
	},
	{
		name: "reject routes that are not functions",
		spec: `
      export const models = {};
      export const actions = {};
      export const routes = {
        "/valid_route": 123
      };
    `,
		expectedResult: errors(["Route /valid_route is invalid: the route must be a function"]),
	},
	{
		name: "accept component",
		spec: `
      export const models = {};
      export const actions = {};
      export const component = ({ react: { useRef, useState }, useRoute, dispatch }) => {
        return <div></div>
      };
    `,
		expectedResult: success,
	},
	{
		name: "reject component if it is not a function",
		spec: `
      export const models = {};
      export const actions = {};
      export const component = {};
    `,
		expectedResult: errors(["`component` export must be a function"]),
	},
	{
		name: "accept a valid source",
		spec: `
      export const models = {};
      export const actions = {};
      export const sources = {
        "ipfs://abcdefhijklmnop": {
          doSourceThing: () => {}
        }
      }
    `,
		expectedResult: success,
	},
	{
		name: "reject source with invalid name",
		spec: `
      export const models = {};
      export const actions = {};
      export const sources = {
        "something.py": {}
      }
    `,
		expectedResult: errors(['Source "something.py" is invalid: the keys must be ipfs:// URIs']),
	},
	{
		name: "reject a valid source with invalid values",
		spec: `
      export const models = {};
      export const actions = {};
      export const sources = {
        "ipfs://abcdefhijklmnop": {
          doSourceThing: 100
        }
      }
    `,
		expectedResult: errors([
			`Source "ipfs://abcdefhijklmnop" is invalid: sources["ipfs://abcdefhijklmnop"].doSourceThing is not a function`,
		]),
	},
]

for (const { name, spec, expectedResult } of VALIDATION_TEST_FIXTURES) {
	test(name, async (t) => {
		const provider = new EthereumBlockProvider("1", "dummy_website")
		const providers = { [`eth:1`]: provider }

		const result = await VM.validateWithoutCreating({
			uri: "...",
			spec: spec,
			providers,
		})
		t.deepEqual(result, expectedResult)
	})
}
