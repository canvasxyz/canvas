import type { ActionContext, DeriveModelTypes, ModelAPI, ModelSchema } from "./types.js"

export class Contract<ModelsT extends ModelSchema = ModelSchema> implements ActionContext<DeriveModelTypes<ModelsT>> {
	public static get models(): ModelSchema {
		throw new Error("the `Contract` class must be extended by a child class providing `static models`")
	}

	public constructor(public readonly topic: string) {}

	public get db(): ModelAPI<DeriveModelTypes<ModelsT>> {
		throw new Error("cannot access this.db outside an action handler")
	}

	public get id(): string {
		throw new Error("cannot access this.id outside an action handler")
	}

	public get did(): string {
		throw new Error("cannot access this.did outside an action handler")
	}

	public get address(): string {
		throw new Error("cannot access this.address outside an action handler")
	}

	public get blockhash(): string | null {
		throw new Error("cannot access this.blockhash outside an action handler")
	}

	public get timestamp(): number {
		throw new Error("cannot access this.timestamp outside an action handler")
	}

	public get publicKey(): string {
		throw new Error("cannot access this.publicKey outside an action handler")
	}
}
