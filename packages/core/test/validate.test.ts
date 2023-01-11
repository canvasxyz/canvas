// tests for checking whether specs are valid

import test, { ExecutionContext } from "ava"
import { VM } from "@canvas-js/core"

async function checkSpec(
	t: ExecutionContext<any>,
	spec: string,
	expectedResult: { valid: boolean; errors: string[]; warnings: string[] }
) {
	const result = await VM.validateWithoutCreating({
		uri: "...",
		spec: spec,
	})
	t.deepEqual(result, expectedResult)
}

test("reject a blank spec", async (t) => {
	await checkSpec(t, "", {
		valid: false,
		errors: ["Spec is missing `models` export", "Spec is missing `actions` export"],
		warnings: [],
	})
})

test("accept a minimal spec", async (t) => {
	await checkSpec(
		t,
		`
  export const models = {};
  export const actions = {};
  `,
		{
			valid: true,
			errors: [],
			warnings: [],
		}
	)
})

test("accept a spec with extraneous exports, with warning", async (t) => {
	await checkSpec(
		t,
		`
  export const models = {};
  export const actions = {};
  export const foobar = {};
  export const whatever = {};

  `,
		{
			valid: true,
			errors: [],
			warnings: ['Warning: extraneous export "foobar"', 'Warning: extraneous export "whatever"'],
		}
	)
})

test("reject invalid model name", async (t) => {
	await checkSpec(
		t,
		`
    export const models = {
      _Something: {}
    }
    export const actions = {}
  `,
		{
			valid: false,
			errors: ["Model name _Something is invalid: model names must match /^[a-z][a-z_]*$/"],
			warnings: [],
		}
	)
})
