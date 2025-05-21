import type { ModelSchema, ModelInit, DeriveModelTypes } from "@canvas-js/core"
import { Contract } from "@canvas-js/core/contract"

export const connection = {
	id: "primary",
	creator: "@profile",
	ref: "@ref",

	image: "string?",
	location: "string?",
	url: "string?",
	text: "string?",
	children: "@connection[]",

	list: "boolean?",
	backlog: "boolean?",
	order: "number?",

	created: "string?",
	deleted: "string?",
	updated: "string?",

	$indexes: ["id"],
	$rules: {
		create: "id === creator + '/' + ref && creator === this.did",
		update: "id === creator + '/' + ref && creator === this.did",
		delete: "creator === this.did",
	},
} as const satisfies ModelInit

export const profile = {
	id: "primary",
	userName: "string",

	firstName: "string",
	lastName: "string",
	geolocation: "string?",
	location: "string?",
	image: "string?",

	created: "string?",
	updated: "string?",

	$rules: {
		create: "id === this.did",
		update: "id === this.did",
		delete: false,
	},
} as const satisfies ModelInit

export const ref = {
	id: "primary",
	creator: "@profile?",
	type: "string?",

	title: "string?",
	image: "string?",
	location: "string?",
	url: "string?",
	meta: "string?",

	created: "string?",
	updated: "string?",
	deleted: "string?",

	$rules: {
		create: "creator === this.did && ['place', 'artwork', 'other'].includes(type)",
		update: "creator === this.did && ['place', 'artwork', 'other'].includes(type)",
		delete: false,
	},
} as const satisfies ModelInit

export const models = {
	connection,
	profile,
	ref,
} as const satisfies ModelSchema

export type ModelTypes = DeriveModelTypes<typeof models>

export default class Refs extends Contract<typeof Refs.models> {
	static models = {
		connection,
		profile,
		ref,
	} satisfies ModelSchema
}

