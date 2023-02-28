// tests for checking whether specs are valid

import test from "ava"

import { VM } from "@canvas-js/core/components/vm"

const success = { valid: true, errors: [], warnings: [] }

const errors = (e: string[]) => ({
	valid: false,
	errors: e,
	warnings: [],
})

const warnings = (w: string[]) => ({
	valid: true,
	errors: [],
	warnings: w,
})

const VALIDATION_TEST_FIXTURES: {
	name: string
	app: string
	expectedResult: Awaited<ReturnType<typeof VM.validate>>
}[] = [
	{
		name: "reject a blank spec",
		app: "",
		expectedResult: errors(["Spec is missing `models` export", "Spec is missing `actions` export"]),
	},
	{
		name: "reject a syntactically invalid spec",
		app: "SAD!@$£WTEGJSWO£W$",
		expectedResult: errors(["SyntaxError: expecting ';'"]),
	},
	{
		name: "accept a minimal spec",
		app: `
      export const models = {};
      export const actions = {};
    `,
		expectedResult: success,
	},
	{
		name: "accept a spec with empty optional exports",
		app: `
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
		app: `
      export const models = {};
      export const actions = {};
      export const foobar = {};
      export const whatever = {};
    `,
		expectedResult: warnings(["extraneous export `foobar`", "extraneous export `whatever`"]),
	},
	{
		name: "reject invalid model name",
		app: `
      export const models = {
        _Something: {}
      }
      export const actions = {}
    `,
		expectedResult: errors(["Model name '_Something' is invalid: model names must match /^[a-z][a-z_]*$/"]),
	},
	{
		name: "accept model",
		app: `
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
		app: `
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
		app: `
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
		app: `
      export const models = {
        thing: {
          id: "string",
          updated_at: "datetime",
          indexes: ["id"]
        }
      }
      export const actions = {}
    `,
		expectedResult: errors(["Index is invalid: 'id' is already an index by default"]),
	},
	{
		name: "reject model with index for field that doesn't exist",
		app: `
      export const models = {
        thing: {
          id: "string",
          updated_at: "datetime",
          indexes: ["whatever"]
        }
      }
      export const actions = {}
    `,
		expectedResult: errors(["Index is invalid: 'whatever' is not a field on model 'thing'"]),
	},
	{
		name: "reject model with missing properties",
		app: `
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
		app: `
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
		app: `
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
		app: `
      export const models = {
        thing: {
          id: "string",
          updated_at: "datetime",
          _Hello: "string"
        }
      }
      export const actions = {}
    `,
		expectedResult: errors(["Model property '_Hello' is invalid: model properties must match /^[a-z][a-z_]*$/"]),
	},
	{
		name: "accept valid action",
		app: `
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
		app: `
      export const models = {};
      export const actions = "not an object";
    `,
		expectedResult: errors(["`actions` export must be an object"]),
	},
	{
		name: "reject action with invalid name",
		app: `
      export const models = {};
      export const actions = {
        _doThing({}, {}) {

        }
      }
    `,
		expectedResult: errors(["Action '_doThing' is invalid: action names must match /^[a-zA-Z]+$/"]),
	},
	{
		name: "reject action not defined as a function",
		app: `
      export const models = {};
      export const actions = {
        doThing: 1234
      }
    `,
		expectedResult: errors(["Action 'doThing' is invalid: 'actions.doThing' is not a function or valid custom action"]),
	},
	{
		name: "reject contracts not defined as an object",
		app: `
      export const models = {};
      export const actions = {};
      export const contracts = 123456;
    `,
		expectedResult: errors(["`contracts` export must be an object"]),
	},
	{
		name: "accept valid contract",
		app: `
      export const models = {};
      export const actions = {};
      export const contracts = {
        milady: {
          chain: "ethereum",
          chainId: "1",
          address: "0x5af0d9827e0c53e4799bb226655a1de152a425a5",
          abi: ["function balanceOf(address owner) view returns (uint balance)"],
        },
      };
    `,
		expectedResult: success,
	},
	{
		name: "reject contract with invalid chain",
		app: `
      export const models = {};
      export const actions = {};
      export const contracts = {
        milady: {
          chain: "bitcoin",
          chainId: "1",
          address: "0x5af0d9827e0c53e4799bb226655a1de152a425a5",
          abi: ["function balanceOf(address owner) view returns (uint balance)"],
        },
      };
    `,
		expectedResult: errors(["Contract 'milady' is invalid: chain \"bitcoin\" is invalid"]),
	},
	{
		name: "reject contract with invalid chainId",
		app: `
      export const models = {};
      export const actions = {};
      export const contracts = {
        milady: {
          chain: "ethereum",
          chainId: [],
          address: "0x5af0d9827e0c53e4799bb226655a1de152a425a5",
          abi: ["function balanceOf(address owner) view returns (uint balance)"],
        },
      };
    `,
		expectedResult: errors(["Contract 'milady' is invalid: chain id [] is invalid"]),
	},
	{
		name: "reject contract with extra fields",
		app: `
      export const models = {};
      export const actions = {};
      export const contracts = {
        milady: {
					somethingElse: "hello",
          chain: "ethereum",
          chainId: "1",
          address: "0x5af0d9827e0c53e4799bb226655a1de152a425a5",
          abi: ["function balanceOf(address owner) view returns (uint balance)"],
        },
      };
    `,
		expectedResult: success,
	},
	{
		name: "reject routes if not object",
		app: `
      export const models = {};
      export const actions = {};
      export const routes = 123456;
    `,
		expectedResult: errors(["`routes` export must be an object"]),
	},
	{
		name: "reject routes with invalid name",
		app: `
      export const models = {};
      export const actions = {};
      export const routes = {
        _Invalid: () => {}
      };
    `,
		expectedResult: errors(["Route '_Invalid' is invalid: the name must match the regex /^(\\/:?[a-zA-Z_]+)+$/"]),
	},
	{
		name: "reject routes that are not functions",
		app: `
      export const models = {};
      export const actions = {};
      export const routes = {
        "/valid_route": 123
      };
    `,
		expectedResult: errors(["Route '/valid_route' is invalid: the route must be a function"]),
	},
	{
		name: "accept a valid source",
		app: `
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
		app: `
      export const models = {};
      export const actions = {};
      export const sources = {
        "something.py": {}
      }
    `,
		expectedResult: errors(["Source 'something.py' is invalid: the keys must be ipfs:// URIs"]),
	},
	{
		name: "reject a valid source with invalid values",
		app: `
      export const models = {};
      export const actions = {};
      export const sources = {
        "ipfs://abcdefhijklmnop": {
          doSourceThing: 100
        }
      }
    `,
		expectedResult: errors([
			`Source 'ipfs://abcdefhijklmnop' is invalid: sources["ipfs://abcdefhijklmnop"].doSourceThing is not a function`,
		]),
	},
	{
		name: "accept a basic custom action",
		app: `
      export const models = {};
      export const actions = {
        doThing: customAction({}, () => {})
      };
    `,
		expectedResult: success,
	},
	{
		name: "reject a basic custom action with an invalid function type",
		app: `
      export const models = {};
      export const actions = {
        doThing: customAction({}, null)
      };
    `,
		expectedResult: errors(["Custom action function is invalid: it should be a function"]),
	},
	{
		name: "reject a basic custom action with no schema/function definition",
		app: `
      export const models = {};
      export const actions = {
        doThing: customAction()
      };
    `,
		expectedResult: errors(["Custom action schema is invalid: it should be an object"]),
	},
	{
		name: "reject if more than one custom action is defined",
		app: `
      export const models = {};
      export const actions = {
        doThing: customAction({}, () => {}),
        doOtherThing: customAction({}, () => {})
      };
    `,
		expectedResult: errors(["Contract is invalid: more than one custom action is defined"]),
	},
]

for (const { name, app, expectedResult } of VALIDATION_TEST_FIXTURES) {
	test(name, async (t) => {
		const result = await VM.validate(app)
		t.deepEqual(result, expectedResult)
	})
}
