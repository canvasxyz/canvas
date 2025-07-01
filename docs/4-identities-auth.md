# Authenticating Users

We need users to authenticate with public-key identities, but we don't want them to have to manually sign every interaction.

As a result, Canvas applications are initialized with **session signers**, which define different ways that users can delegate a session key to sign individual interactions.

## SIWESigner

The `SIWESigner` class exported by `@canvas-js/signer-ethereum` matches actions with `eip155:*` chains, the EIP-155 identifier for Ethereum. This is also our most often used signer.

```ts
import { BrowserProvider } from "ethers"
import { SIWESigner } from "@canvas-js/signer-ethereum"
import { Canvas, Contract } from "@canvas-js/core"

class Chat extends Contract<typeof Chat.models> {
  static topic = "chat.example.xyz"

  static models = {
    messages: {
      id: "primary",
      content: "string",
      address: "string"
    }
  }

  async createMessage(content: string) {
    this.db.create("messages", {
      content,
      address: this.address
    })
  }
}

const provider = new BrowserProvider(window.ethereum)
const jsonRpcSigner = await provider.getSigner()

const app = await Canvas.initialize({
  topic: "example.xyz",
  contract: Chat,
  signers: [new SIWESigner({ signer: jsonRpcSigner })],
})

// the user will first be prompted for a SIWE signature
await app.actions.createMessage("can I get an uhhhh yeah??")

// subsequent actions calls will use the cached session
await app.actions.createMessage("uhhhh yeah!!")
```

Before a user can interact with an application, they must first authorize a session. Sessions consist of an ephemeral keypair and a chain-specific payload representing a user's (temporary) authorization of that keypair to sign actions on their behalf.

Session signers are responsible for safely managing the ephemeral private keys, and requesting authorization of new sessions from the end user when necessary.

In the example, the `SIWESigner` will do this the first time the user calls an action, and/or whenever the session expires, by requesting a signature from the `signer: ethers.AbstractSigner` it was given. If you initialize `SIWESigner` with a Metamask connection, it will pop up a message asking the user to sign a [Sign-In with Ethereum](https://eips.ethereum.org/EIPS/eip-4361) message with the ephemeral public key as the resource URI.

You can provide multiple signers to `Canvas.initialize`, and you can control which signer is used to sign actions using either the `chain` or `signer` options of the action method:

```ts
const app = await Canvas.initialize({
  topic: "example.xyz",
  contract: Chat,
  signers: [
    new SIWESigner({ signer: jsonRpcSigner }),
    new SIWESigner({ signer: Wallet.createRandom() }),
  ],
})

// Use a specific signer
await app.actions.as(app.signers[1]).createMessage("foo")

// Defaults to the first signer app.signers[0]
await app.actions.createMessage("baz")
```

The SIWESigner class also supports a `burner` parameter, which will
let the signer create a temporary burner key internally. Burner keys
are not persisted; if you would like a persistent burner key, create
an ethers.Wallet with a random private key yourself.

If the SIWESigner class is created without a `burner` parameter, it
will only be used to verify actions made by others, and will not be
able to create actions itself.

## Updating signers

Finally, you can update the list of active signers on an application
by calling `app.updateSigners`.

```ts
// Get a list of all signers attached to the application
app.signers.getAll()

// Replace the current SIWESigner
const signer = new SIWESigner({ burner: true })
app.updateSigners([
    signer,
    ...app.signers.getAll().filter((s) => !(s instanceof SIWESigner))
])

```

This is useful if you want users to be able to log in and out of
applications.