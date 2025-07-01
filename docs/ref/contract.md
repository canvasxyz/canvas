# Contract API

Each Canvas application is defined as a contract. We support two contract syntaxes:

* [Class Contracts](#class-contracts): Solidity-style classes
* [Contracts with Permissions](#contracts-with-permissions): Firebase-style database permissions

## Class Contracts

The class syntax is recommended for most applications.

```ts
import { Contract } from "@canvas-js/core/contract"

class Chat extends Contract<typeof Chat.models> {
  static topic = "chat.example.xyz"

  static models = {
    messages: {
      id: "primary",
      content: "string",
    }
  }

  async createMessage(content: string) {
    this.db.create("messages", {
      content,
      address: this.address
    })
  }
}
```

A constructor is optional, but if provided, its arguments will be hashed and appended to the topic.

```ts
class NamespacedChat extends Contract<typeof Chat.models> {
  static topic = "chat.example.xyz"

  createMessage(content: string) {
    super(content)
  }
  constructor(namespace: string) {}
}

const app = await NamespacedChat.initialize("mynamespace")
```

You can initialize a class contract by providing it to `Canvas.initialize`, or calling `initialize()` on it directly:

```ts
const app = await Canvas.initialize({
  contract: Chat,
  topic: "override.example.xyz"
})
```

Once initialized, methods on the contract are called via `this.actions`.

```ts
app.actions.createMessage("I'm a scary and powerful fire demon!")
```

## Contracts with Permissions

You can also create a Firebase-style contract with permissions for each table, using a `$rules` object on the model.

This is useful for creating simpler contracts, and applications that resemble databases but still have constraints on what data can be stored in the application.

If you use $rules, you must use it for all models on a contract instead of specifying actions.

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

### External API for Contracts with Permissions

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

## Contract APIs

Inside contracts, actions can access these fields:

* [ActionContext](#actioncontext): Contains information like the current message ID for the action.
* [ModelAPI](./model.md#modelapi): Contains database APIs for reading, writing, transacting, generating IDs, etc.

In class contracts, actions are called with `this` set to an [ActionContext](../api/core.md#api):

| Property | Description |
|----------|-------------|
| `db` | A ModelAPI instance. See below. |
| `id` | The message ID of the current action, a 32-character hex string. |
| `did` | The DID identifier for the user. |
| `address` | A shortened DID identifier for the user. If you are writing an application for a specific chain, you can use this to get the e.g. Ethereum address of your user. |
| `publicKey` | A session-specific public key that the user authorized, which was used to sign this specific action, provided as a did:key identifier. |
| `timestamp` | A user-reported timestamp of their action. |
| `blockhash` | Not currently used. |


## Import Styles

Each contract can be declared either inline or as a separate file or string, which will be imported as an ES module. Contracts that are imported as an ES module will be run inside a QuickJS WASM container.

Some application platforms do not work well with the QuickJS WASM runtime. For those applications, we recommend declaring your contract inline instead.
