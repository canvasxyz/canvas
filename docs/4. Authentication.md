# Authentication

We want end users to authenticate with public-key identities, but it’s not always practical to prompt the user for a wallet signature on every interaction. As a result, Canvas applications are initialized with **session signers**, which define different ways that users can authenticate themselves.

For example, the `SIWESigner` exported by `@canvas-js/chain-ethereum` matches actions with `eip155:*` chains, the EIP-155 identifier for Ethereum.

```ts
import { BrowserProvider } from "ethers"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { Canvas } from "@canvas-js/core"

const provider = new BrowserProvider(window.ethereum)
const jsonRpcSigner = await provider.getSigner()

const app = await Canvas.initialize({
  contract: { ... },
  signers: [new SIWESigner({ signer: jsonRpcSigner })],
})

// the user will first be prompted for a SIWE signature
await app.createPost({ content: "can I get an uhhhh yeah??" })

// subsequent actions calls will use the cached session
await app.createPost({ content: "uhhhh yeah!!" })
```

Before a user can interact with a Canvas application, they must first authorize a session. Sessions consist of an ephemeral keypair and a chain-specific payload representing a user's (temporary) authorization of that keypair to sign actions on their behalf. Session signers are responsible for safely managing the ephemeral private keys, and requesting authorization of new sessions from the end user when necessary.

In the example, the `SIWESigner` will do this the first time the user calls an action, and/or whenever the session expires, by requesting a signature from the `signer: ethers.AbstractSigner` it was given. If you initialize `SIWESigner` with a Metamask connection, it will pop up a message asking the user to sign a [Sign-In with Ethereum](https://eips.ethereum.org/EIPS/eip-4361) message with the ephemeral public key as the resource URI.

You can provide multiple signers to `Canvas.initialize`, and you can control which signer is used to sign actions using either the `chain` or `signer` options of the action method:

```ts
const app = await Canvas.init({
  contract: { ... },
  signers: [
    new SIWESigner({ signer: jsonRpcSigner }),
    new SIWESigner({ signer: Wallet.createRandom() }),
  ],
})

// Use a specific signer
await app.actions.createPost({ content: "foo" }, { signer: app.signers[1] })

// Use first signer matching a certain chain
await app.actions.createPost({ content: "bar" }, { chain: "eip155:1" })

// Defaults to the first signer app.signers[0]
await app.actions.createPost({ content: "baz" })
```

Strictly speaking, you _can_ sign actions using signers that weren't provided at initialization (and thus aren't in the `app.signers` array). The caveat is that you must still have a signer matching the same family of chains in `app.signers`, or else session verification will fail.
