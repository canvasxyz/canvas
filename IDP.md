# Canvas Identity Provider

Canvas signed data structures are intended to be used for performing
distributed calls to compute nodes, but Canvas sessions/actions can
also be used as self-certifying authentication and authorization
objects.

This allows developers to emulate the functionality of an OAuth or
OpenID service for third party developers.

## Authentication/Authorization Flow

In OAuth, a third-party service makes an authorization request
to a resource owner, then converts it into an access token through
an authorization server. They can then use an access token to
read/write protected resources:

```
     +--------+                               +---------------+
     |        |--(A)- Authorization Request ->|   Resource    |
     |        |<-(B)-- Authorization Grant ---|     Owner     |
     |        |                               +---------------+
     |        |
     |        |                               +---------------+
     |        |--(C)-- Authorization Grant -->| Authorization |
     | Client |<-(D)----- Access Token -------|     Server    |
     |        |                               +---------------+
     |        |
     |        |                               +---------------+
     |        |--(E)----- Access Token ------>|    Resource   |
     |        |<-(F)--- Protected Resource ---|     Server    |
     +--------+                               +---------------+
```

Canvas is a self-custodial identity provider and necessarily involves
a different flow. Sessions and actions are both [self-certifying][1]
so the client does not interact with a server during the generation
of auth material, but presents the material when it accesses a resource
instead.

[1]: https://jaygraber.medium.com/web3-is-self-certifying-9dad77fd8d81

The identity provider requires an authorization token (signature)
to be constructed for each action that the client wants to take.
Instead of presenting a bearer token alongside a REST or HTTP
request, for example, we must actually sign the request, using the
client library, and then present it as a signed object.

```
     +--------+                               +---------------+
     |        |--(A)- Request Topic/Nonce   ->|    API        |
     |        |<-(B)-- Return Topic/Nonce  ---|    Server     |
     |        |                               +---------------+
     |        | +----------------------------------+
     |        | |           SessionSigner          |
     |        | |                                  |
     |        |-|-- Generate Authorization Key --  |
     |        |-|< -----------------------------|  |
     |        | |                                  |
     |        |-|-- Sign Session Authorization  -  |
     |        |-|< -----------------------------|  |
     |        | |                                  |
     | Client | +----------------------------------+
     |        |
     |        | +----------------------------------+
     |        | |          DelegateSigner          |
     |        | |                                  |
     |        |-|-- Sign Action Authorization - |  |
     |        |-|< -----------------------------|  |
     |        | |                                  |
     |        | +----------------------------------+
     |        |                               +---------------+
     |        |--(E)-- Session/Action Pair -->|    API        |
     |        |<-(F)--- Write Confirmation ---|    Server     |
     +--------+                               +---------------+
```

Here, `SessionSigner` and `DelegateSigner` are both classes
that can be imported from a specific *signer implementation*.
Signer implementations can be created for any public key
authorization scheme, like Ethereum, OpenID Connect, AT Protocol,
etc.

We recommend importing SIWESigner from `@canvas-js/chain-ethereum`
as the default SessionSigner. When creating a SIWESigner, it will
automatically instantiate an internal DelegateSigner.

## Client Identities

The client is identified by a [did:pkh identifier]([1]), which
is a generative DID identifier based on a blockchain wallet address. For
example, `did:pkh:eip155:1:0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`
corresponds to vitalik.eth's mainnet address.

[1]: https://github.com/w3c-ccg/did-pkh/blob/main/did-pkh-method-draft.md

When a third-party developer registers itself against a Canvas identity
service, they should generate and store a private key, e.g. as an environment
variable. They can then register their public address or did:pkh identifier
with the application implementing a Canvas IDP.

Applications with open federation may not require registration
(outside services can just participate as federation clients) but API
providers may provide additional capabilities for registered clients.

## Directory Services

The application implementing a Canvas IDP may use a **directory
service** in order to restrict readers/writers to a list of acceptable
public addresses.

In Canvas-federated applications, this is handled by a file called the
federation contract ("contract") that defines executable code for each
incoming action.

However, actions outside the contract can also be signed and passed
over the network (e.g. if a centralized service has only decided to
federate part of its functionality, it can use sessions/actions
outside the contract for non-federated functionality).

## Signer Types

Any Canvas session signer/action signer can be used to implement an
identity service, but we recommend using Ethereum signers as those are
currently the most extensively used and tested.

* For the session authorization message, see [packages/interfaces/src/Session.ts][2].
* For the action authorization message, see [packages/interfaces/src/Action.ts][3].
* For how each message is signed, see:
  * packages/chain-ethereum/src/siwe/SIWESigner.ts (SIWE, used by default)
  * packages/chain-ethereum/src/siwe/types.ts
  * packages/chain-ethereum/src/eip712/Eip712Signer.ts (EIP-712)
  * packages/chain-ethereum/src/eip712/types.ts

[2]: https://github.com/canvasxyz/canvas/blob/main/packages/interfaces/src/Session.ts
[3]: https://github.com/canvasxyz/canvas/blob/main/packages/interfaces/src/Action.ts

## Code Examples

Example code for each of the steps above is provided below.

### Client: Generating a new public key

```ts
import { SIWESigner } from "@canvas-js/chain-ethereum"
const sessionSigner = new SIWESigner()
```

### Client: Importing an existing private key

```ts
import { ethers } from "ethers"
import { SIWESigner } from "@canvas-js/chain-ethereum"
const wallet = new ethers.Wallet('0x...')
const sessionSigner = new SIWESigner({ signer: wallet })
```

### Client: Generating a session/action pair

```ts
import { Action, Session } from "@canvas-js/interfaces"
import { SIWESessionData } from "@canvas-js/chain-ethereum"
const { payload, signer: delegateSigner } = await sessionSigner.newSession(topic)
const session: Session<SIWESessionData> = payload

// TODO: The code for generating actions should be wrapped,
// and exposed as a single call provided by the federation SDK service.

const action: Action = {
	type: "action",
	did: session.did,
	name: "createThread",
	args: { title: "Hello world", body: "foobar" },
	context: {
		timestamp: session.context.timestamp,
	},
}
const actionSignature = await delegateSigner.sign(actionMessage)
```

### Client: Presenting a session/action pair

```ts
// TODO: Define a way for presenting session/action pairs,
// e.g. SWATs or signed web-action tuples

const encoded = cbor.encode([action, actionSignature, session, sessionSignature])
```

### Client/Server: Verifying a session/action pair

```ts
import { ed25519 } from "@canvas-js/signatures"
import { SIWESigner } from "@canvas-js/chain-ethereum"

const [action, actionSignature, session, sessionSignature] = cbor.decode(encoded)

// TODO: Check for coupling between action and session

await new SIWESigner().verifySession(topic, session)
await ed25519.verify(actionSignature, actionMessage)
```

### Server: Checking the session/action pair against a directory ACL

```ts
const writeAuthorizedUsers = [
  "did:pkh:eip155:1:0x39963ab005866E0aF9Df3491f8D344f68d47B776",
  "did:pkh:eip155:1:0x430B93C2fF96Ba02703B34F3380D2eb3f402C760",
]

const [action, actionSignature, session, sessionSignature] = cbor.decode(encoded)

assert(action.did === session.did)
assert(writeAuthorizedUsers.includes(action.did))
```

### Server: Using a session to authorize read access

```ts
// TODO
```
