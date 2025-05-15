# @canvas-js/signer-ethereum

The Ethers (v6) Ethereum signer takes an `ethers` signer, or generates a random `ethers.Wallet`,
and uses it to sign a SIWE message authenticating a new session.

It also handles verification of messages matching this standard, and can be used in
conjuction with `@canvas-js/signer-ethereum-viem`.

## Table of Contents

- [Installation](#installation)
- [API](#api)
  - [SIWESigner](#siwesigner)
  - [SIWFSigner](#siwfsigner)

## Installation

```
npm i @canvas-js/signer-ethereum
```

## SIWESigner

The `SIWESigner` class implements Sign-in With Ethereum (SIWE) functionality for Canvas. It allows users to authenticate using an Ethereum wallet by signing a standard SIWE message.

**By default, SIWESigner is initialized in read-only mode.** You should configure the signer with `{ burner: true }` to create a signer with a randomized burner address, or `{ signer: ethers.Signer }` to create a signer that uses a wallet.

SIWESigner works well with ethers.Signer instances provided by a browser wallet, since the signer is used to authorize a session key that signs individual actions.

### Initialization

```ts
import { SIWESigner } from "@canvas-js/signer-ethereum";

// With an existing ethers signer
const signer = new SIWESigner({
  signer: yourEthersSigner, // An ethers.js Signer instance
  chainId: 1, // Optional, defaults to 1 (Ethereum mainnet)
});

// With a random burner wallet
const burnerSigner = new SIWESigner({
  burner: true, // Creates a random ethers.Wallet for signing
  chainId: 5, // Optional, specify a testnet chain ID
});

// Read-only mode (can only verify, not create sessions)
const readOnlySigner = new SIWESigner();
```

### Usage Examples

**Creating a Session**

```ts
// Get a session for a specific topic
const session = await signer.getSession("my-app-topic");

// Later verify a session
signer.verifySession("my-app-topic", session);
```

**Working with DIDs**

```ts
// Get the DID for the current signer
const did = await signer.getDid();
// "did:pkh:eip155:1:0x123..."

// Extract the address from a DID
const address = signer.getAddressFromDid(did);
// "0x123..."
```

## SIWFSigner

The `SIWFSigner` class implements Sign-in With Farcaster (SIWF) functionality for Canvas. It allows Farcaster users to authenticate using their Farcaster account's custody address.

### Initialization

```ts
import { SIWFSigner } from "@canvas-js/signer-ethereum";

// Basic initialization
const farcasterSigner = new SIWFSigner({
  custodyAddress: "0x123...", // Optional, but required for creating messages
});
```

When you configure a SIWFSigner for your application, you will usually configure it without a custodyAddress initially. This will allow it to *accept* Farcaster signed messages from other users.

To allow the signer to write to the application, you should then replace it with a signer with the appropriate authorization data.

### Authorizing

First, request a SIWF message using Farcaster AuthKit.

Then, use the static method SIWFSigner.parseSIWFMessage to obtain an authorization data:

You can now ask the Farcaster signer to *manually* create a new SIWF session for you:

```ts
const { authorizationData, topic, custodyAddress } = SIWFSigner.parseSIWFMessage(message, signature)
const signer = new SIWFSigner({ custodyAddress, privateKey: newSessionPrivateKey.slice(2) })

const address = await signer.getDid()

const timestamp = new Date(authorizationData.siweIssuedAt).valueOf()
const { payload, signer: delegateSigner } = await signer.newSIWFSession(
  topic,
  authorizationData,
  timestamp,
  getBytes(newSessionPrivateKey),
)
```

Now that you have a valid signer, you should remove the default read-only signer that you have attached to your application, and replace it with your newly created signer.

```ts
const otherSigners = app.signers.getAll().filter((signer) => signer.key !== "signer-ethereum-farcaster")
app.updateSigners([signer, ...otherSigners])
```

Finally, append the session you created to your app's message log.

```ts
app.messageLog.append(payload, { signer: delegateSigner })
```

### Authorizing with a Frame

```ts
// Generate a nonce for frame-based authentication
const { nonce, privateKey } = SIWFSigner.newSIWFRequestNonce("my-app-topic");

// Later, with the SIWF message and signature from Farcaster frame auth
const { authorizationData, custodyAddress, topic } = SIWFSigner.parseSIWFMessage(
  siwfMessage,
  siwfSignature
);

// Create a new session using the auth data
const { payload: session, signer } = await farcasterSigner.newSIWFSession(
  topic,
  authorizationData,
  Date.now(),
  privateKey
);
```
