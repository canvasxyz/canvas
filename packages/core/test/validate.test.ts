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
		name: "accept model with valid indexes",
		spec: `
      export const models = {
        thing: {
          something: "string",
          indexes: ["something"]
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
		name: "reject model with invalid indexes",
		spec: `
      export const models = {
        thing: {indexes: [1]}
      }
      export const actions = {}
    `,
		expectedResult: {
			valid: false,
			errors: ["Model definition contains invalid indexes (1)"],
			warnings: [],
		},
	},
	{
		name: "reject model with invalid properties",
		spec: `
      export const models = {
        thing: {
          id: "string"
        }
      }
      export const actions = {}`,
		expected: {
			valid: false,
			errors: [`Model properties {"id":"string"} are invalid`],
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
