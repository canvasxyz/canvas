import type { ModelSchema, ModelInit } from "@canvas-js/core"

const connection: ModelInit = {
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
		create: "this.sender === creator && id === creator + '/' + ref",
		update: "this.sender === creator && id === creator + '/' + ref",
		delete: "this.sender === creator",
	},
}

const profile: ModelInit = {
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
		create: "this.sender === id",
		update: "this.sender === id",
		delete: false,
	},
}

const ref: ModelInit = {
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
		create: "this.id === txid && this.sender === creator && ['place', 'artwork', 'other'].includes(type)",
		update: "this.id === txid && this.sender === creator && ['place', 'artwork', 'other'].includes(type)",
		delete: false,
	},
}

export const models = {
	connection,
	profile,
	ref,
} satisfies ModelSchema
