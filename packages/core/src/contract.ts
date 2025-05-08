import type { DeriveModelTypes, ModelAPI, ModelSchema } from "./types.js"

export class Contract<T extends ModelSchema = ModelSchema> {
	protected readonly topic: string

	protected static get models(): ModelSchema {
		throw new Error("the `Contract` class must be extended by a child class providing `static models`")
	}

	protected constructor(topic: string) {
		this.topic = topic
	}

	protected get db(): ModelAPI<DeriveModelTypes<T>> {
		throw new Error("cannot access this.db outside an action handler")
	}

	protected get id(): string {
		throw new Error("cannot access this.id outside an action handler")
	}

	protected get did(): string {
		throw new Error("cannot access this.did outside an action handler")
	}

	protected get address(): string {
		throw new Error("cannot access this.address outside an action handler")
	}

	protected get blockhash(): string | null {
		throw new Error("cannot access this.blockhash outside an action handler")
	}

	protected get timestamp(): number {
		throw new Error("cannot access this.timestamp outside an action handler")
	}

	protected get publicKey(): string {
		throw new Error("cannot access this.publicKey outside an action handler")
	}
}
