// tests for checking whether specs are valid

import test from "ava"
import { VM } from "@canvas-js/core"

const VALIDATION_TEST_FIXTURES = [
	{
		name: "reject a blank spec",
		spec: "",
		expectedResult: {
			valid: false,
			errors: ["Spec is missing `models` export", "Spec is missing `actions` export"],
			warnings: [],
		},
	},
	{
		name: "accept a minimal spec",
		spec: `
      export const models = {};
      export const actions = {};
    `,
		expectedResult: {
			valid: true,
			errors: [],
			warnings: [],
		},
	},
	{
		name: "accept a spec with extraneous exports, with warning",
		spec: `
      export const models = {};
      export const actions = {};
      export const foobar = {};
      export const whatever = {};
    `,
		expectedResult: {
			valid: true,
			errors: [],
			warnings: ['Warning: extraneous export "foobar"', 'Warning: extraneous export "whatever"'],
		},
	},
	{
		name: "reject invalid model name",
		spec: `
      export const models = {
        _Something: {}
      }
      export const actions = {}
    `,
		expectedResult: {
			valid: false,
			errors: ["Model name _Something is invalid: model names must match /^[a-z][a-z_]*$/"],
			warnings: [],
		},
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
		expectedResult: {
			valid: true,
			errors: [],
			warnings: [],
		},
	},
	{
		name: "accept model with valid indexes",
		spec: `
      export const models = {
        thing: {
          id: "string",
          updated_at: "datetime",
          // something: "string",
          indexes: []
        }
      }
      export const actions = {}
    `,
		expectedResult: {
			valid: true,
			errors: [],
			warnings: [],
		},
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
		expectedResult: {
			valid: false,
			errors: ["Index is invalid: 1 is not a string or a list of strings"],
			warnings: [],
		},
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
		expectedResult: {
			valid: false,
			errors: ['Index is invalid: "id" is already an index by default'],
			warnings: [],
		},
	},
	{
		name: "reject model with 'updated_at' index",
		spec: `
      export const models = {
        thing: {
          id: "string",
          updated_at: "datetime",
          indexes: ["updated_at"]
        }
      }
      export const actions = {}
    `,
		expectedResult: {
			valid: false,
			errors: ['Index is invalid: "updated_at" is already an index by default'],
			warnings: [],
		},
	},
	{
		name: "reject model with 'id' and 'updated_at' index",
		spec: `
      export const models = {
        thing: {
          id: "string",
          updated_at: "datetime",
          indexes: ["id", "updated_at"]
        }
      }
      export const actions = {}
    `,
		expectedResult: {
			valid: false,
			errors: [
				'Index is invalid: "id" is already an index by default',
				'Index is invalid: "updated_at" is already an index by default',
			],
			warnings: [],
		},
	},
	{
		name: "reject model with missing properties",
		spec: `
      export const models = {
        thing: {}
      }
      export const actions = {}
    `,
		expectedResult: {
			valid: false,
			errors: [
				"Model 'thing' is invalid: there is no 'id' field",
				"Model 'thing' is invalid: there is no 'updated_at' field",
			],
			warnings: [],
		},
	},
]

for (const { name, spec, expectedResult } of VALIDATION_TEST_FIXTURES) {
	test(name, async (t) => {
		const result = await VM.validateWithoutCreating({
			uri: "...",
			spec: spec,
		})
		t.deepEqual(result, expectedResult)
	})
}
