# Contract API

Each Canvas application is defined as a contract, but we support several different contract syntaxes:

* [Contracts with Mutators](#contracts-with-mutators): Express-style, models and actions
* [Contracts with Permissions](#contracts-with-permissions): Firebase-style, models only
* [Class Contracts](#class-contracts): Solidity-style classes

Inside the contract, actions and permission checks can access these objects:

* [ActionContext](#actioncontext): Contains information like the current message ID for the action.
* [ModelAPI](./model.md#modelapi): Contains database APIs for reading, writing, transacting, generating IDs, etc.

Additionally, contracts can be declared [inline](#inline-contracts), or as a separate [ES module](#module-contracts).

## Contracts with Mutators

This basic Express-style syntax is recommended for most applications.

```ts
import { Actions, ModelSchema } from "@canvas-js/core"

export const models = {
  messages: {
    id: "primary",
    content: "string",
  }
} satisfies ModelSchema

export const actions = {
  createMessage(content: string) {
    this.db.set("messages", { id: this.db.id(), content })
  }
} satisfies Actions<typeof models>
```

## Contracts with Permissions

You can also create a Firebase-style contract with permissions for each table, using a `$rules` object on the model.

This is useful for creating simpler contracts, and applications that resemble databases but still have programmable constraints on what data can be stored in the application.

::: tip
A current limitation is that if you use $rules, you must use it for all models on a contract instead of specifying actions. This is a temporary limitation we have in place, since interoperability between `actions` and `$rules` has not been fully documented yet.
:::

```ts
import { ModelSchema } from "@canvas-js/core"

export const models = {
  items: {
    id: "primary",
    creator: "string",
    content: "string",
    $rules: {
      create: "creator === this.did",
      update: "creator === this.did",
      delete: false
    }
  }
}
```

Inside each permission check, `this` is the current [ActionContext](#actioncontext), and other fields on the database are in the global scope.

### External Database API

Once you've set up a contract with rules, you can use the `app.create`, `app.update`, `app.delete` methods to access the application, like a regular database:

```ts
const app = await Canvas.initialize({
  topic: "example.xyz",
  contract: { models },
  signers: [new SIWESigner({ burner: true })]
})

const did = await app.signers.getFirst().getDid()

await app.create("items", {
  creator: did,
  content: "I'm a scary and powerful fire demon!"
})
```

## Class Contracts

This is a new and experimental syntax, supported as of version 0.15.

```ts
import { Contract } from "@canvas-js/core/contract"

class Example extends Contract<typeof Example.models> {
  static models = {
    items: { id: "primary", content: "string" }
  }

  add(content: string) {
    this.db.set({ id: this.id(), content })
  }
}

const app = await Canvas.initialize({
  contract: Example,
  topic: "example.xyz"
})

app.add("I'm fastened to this hearth and I can't stir so much as a foot away.")
```

## ActionContext

Contract actions are called with `this` set to an ActionContext, with these fields:

| Property | Description |
|----------|-------------|
| `db` | A ModelAPI instance. See below. |
| `id` | The message ID of the current action, a 32-character hex string. |
| `did` | The DID identifier for the user. |
| `address` | A shortened DID identifier for the user. If you are writing an application for a specific chain, you can use this to get the e.g. Ethereum address of your user. |
| `publicKey` | A session-specific public key that the user authorized, which was used to sign this specific action, provided as a did:key identifier. |
| `timestamp` | A user-reported timestamp of their action. |
| `blockhash` | Not currently used. |

See ActionContext in the [API Types](../api/core.md#api) for more information.

## Import Styles

Each contract can be declared either inline or as a separate file or string, imported as an ES module.

Contracts that are imported as an ES module will be run inside a QuickJS WASM container. Some application platforms do not work well with the QuickJS WASM. For those applications, we recommend declaring your contract as inline functions instead.

### Inline Contracts

Contracts can be provided as vanilla JavaScript objects, or a vanilla TS/JS class:

::: code-group

```ts [Function Contract]
const models = { ... }
const actions = { ... }

await Canvas.initialize({
  topic: "example.xyz",
  contract: { models, actions },
})
```

```ts [Class Contract]
class MyContract extends Contract<typeof MyContract.models>{
  static models = { ... }
}

await Canvas.initialize({
  topic: "example.xyz",
  contract: Contract
})
```

:::

### Module Contracts

When using a contract from the command line with `canvas run contract.ts`, it is always imported as a file, and treated as an ES module. Modules can do any of the following:

1. Export independent values for `actions` and `models`
2. Export a contract object with `actions` and `models` on it
3. Export a class, such as `class MyContract { ... }`

You can also import a contract as a module by providing it as a string, or using a raw import option, such as Vite's `?raw` option, or [TC39 import attributes](https://github.com/tc39/proposal-import-attributes?tab=readme-ov-file#import-attributes). The specific syntax for this will vary depending on the bundler you are using.

::: code-group

```ts [String Contract]
await Canvas.initialize({
  topic: "example.xyz",
  contract: `
export models = { ... }
export actions = { ... }
`,
})
```

```ts [ES Module with Vite]
import contract from "./contract.js?raw"

await Canvas.initialize({
  topic: "example.xyz",
  contract,
})
```

```ts [ES Module with Import Attributes]
import contract from "./contract.js"  with { type: "text" }

await Canvas.initialize({
  topic: "example.xyz",
  contract,
})
```
