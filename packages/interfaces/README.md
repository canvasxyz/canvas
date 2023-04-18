# @canvas-js/interfaces

This package exports TypeScript types for Canvas messages and other interfaces, along with some serialization utility methods.

## Table of Contents

- [Messages](#messages)
  - [Sessions](#sessions)
  - [Actions](#actions)
  - [Custom actions](#custom-actions)
- [Models](#models)
- [Chain Implementations](#chain-implementations)
- [Serialization methods](#serialization-methods)

## Messages

Canvas operates on two basic types of messages: _actions_ and _sessions_. Actions are signed function calls that are evaluated by the contract; sessions are used to authorize delegate keys so that users don't have to directly sign every action they want to take.

```ts
export type Message = Action | Session | CustomAction
```

### Sessions

```ts
/**
 * A user can sign a `Session` to authorize a delegate key to sign actions on their behalf.
 *
 * The signature, address, and blockhash formats vary by chain.
 */
export type Session = {
	type: "session"
	signature: string
	payload: {
    // The ipfs://... URI of the app contract
		app: string

    // CAIP-2 identifier for a chain supported by the app contract
		chain: string

    // address of the user authorizing the session
		from: string

		sessionAddress: string  // public address of the delegate key
		sessionDuration: number // duration in milliseconds
		sessionIssued: number   // issue time in milliseconds since 1 January 1970 00:00:00 UTC

    // Blockhash of `chain` at issue time; required by peers except in --unchecked mode.
    // Used to validate `sessionIssued`.
		block: string | null
	}
}

export type SessionPayload = Session["payload"]
```

### Actions

```ts
/**
 * An `Action` is either signed directly by a user or indirectly through a session.
 * The address recovered from verifying the signature must match `action.session`
 * if `action.session !== null`, or else must match `action.payload.from`.
 * 
 * The signature, address, and blockhash formats vary by chain.
 */
export type Action = {
	type: "action"
	signature: string
	session: string | null
	payload: {
    // The ipfs://... URI of the app contract
		app: string

    // CAIP-2 identifier for a chain supported by the app contract
		chain: string

    // address of the user signing the action
		from: string

    // name and arguments of the contract function to invoke.
    // action arguments are the JSON primitives `null | boolean | number | string`
		call: string
		callArgs: Record<string, ActionArgument>

    // Blockhash of `chain` at `timestamp`; required by peers except in --unchecked mode.
    // Used to validate `timestamp` and call external on-chain contracts.
		block: string | null

    // milliseconds since 1 January 1970 00:00:00 UTC
		timestamp: number
	}
}

export type ActionPayload = Action["payload"]

export type ActionArgument = null | boolean | number | string
```

### Custom actions

> ⚠️ This is an advanced use case that is likely to evolve. Use with caution.

Contracts can also optionally export a handler for "custom actions", which are unsigned payloads validating an application-defined JSON Schema document.

```ts
export type CustomAction = {
	type: "customAction"
	name: string
	payload: any
	app: string
}
```

## Models

Canvas contracts export a set of model types, which are schemas for the application database that the action handlers in the contract can write to.

The model schemas are very simple, consisting of just 

```ts
/**
 * A `ModelType` is a value-level representation of a model field type.
 * used as the TypeScript type for model field *types*.
 */
export type ModelType = "boolean" | "string" | "integer" | "float" | "datetime"

/**
 * A `ModelValue` is a type-level representation of a model field types,
 * used as the TypeScript type for model field *values*.
 */
export type ModelValue = null | boolean | number | string

/**
 * An `Index` defines a list of database indexes to be generated and maintained for a model.
 */
export type Index = string | string[]

/**
 * A `Model` is a map of property names to `ModelType` types.
 * All models must have `id: "string"` and `updated_at: "datetime"` properties.
 */
export type Model = {
  id: "string"; 
  updated_at: "datetime";
  indexes?: Index[];
} & Record<string, ModelType>

```

## Chain Implementations

Canvas is designed to be chain-agnostic, but it needs to know something about the chains so that it can validate signatures and blockhashes. The methods necessary for this are encapsulated in the `ChainImplementation` interface.

`ChainImplementation` is generic in two parameters `Signer` and `DelegatedSigner`, which in each chain implementation class are instantiated with the appropriate chain-specific type. `Signer` is for direct interactions with the user, and `DelegatedSigner` is whatever the delegated key or private wallet class is appropriate for the chain. For example, `EthereumChainImplementation` is declared as a `ChainImplementation<ethers.Signer, ethers.Wallet>`.

```ts
export interface ChainImplementation<Signer = unknown, DelegatedSigner = unknown> {
  /* CAIP-2 chain identifier */
	chain: string

  /**
   * Signature verification methods 
   *
   * These are used internally by peers when applying actions and sessions.
   */

  // verify an action signature
	verifyAction(action: Action): Promise<void>

  // verify a session signature
	verifySession(session: Session): Promise<void>

  /**
   * Signature generation / delegate signer lifecycle methods 
   * 
   * These are used by the front-end client library @canvas-js/hooks
   * to streamline automated session management and 
   */

  // use the signer to sign a session payload
	signSession(signer: Signer, payload: SessionPayload): Promise<Session>

  // use the signer to directly sign an action payload
	signAction(signer: Signer, payload: ActionPayload): Promise<Action>

  // use the delegated signer to sign an action payload
	signDelegatedAction(delegatedSigner: DelegatedSigner, payload: ActionPayload): Promise<Action>

  // get the address of a signer
	getSignerAddress(signer: Signer): Promise<string>

  // get the address of a delegated signer
	getDelegatedSignerAddress(delegatedSigner: DelegatedSigner): Promise<string>

  // create a new delegate signer instance
	generateDelegatedSigner(): Promise<DelegatedSigner>

  // export a delegate signer's private key to a string
	exportDelegatedSigner(delegatedSigner: DelegatedSigner): string

  // import a delegate signer from an exported private key
	importDelegatedSigner(privateKey: string): DelegatedSigner


  /**
   * Provider and blockhash methods
   */

  // does the chain implementation support fetching blocks?
	hasProvider(): boolean

  // get the blockhash of the latest block
  getLatestBlock(): Promise<string>
}
```

## Serialization methods

These methods rely on deterministic and canonical JSON serialization, which isn't guaranteed by native `JSON.stringify`. They use the [`safe-stable-stringify`](https://github.com/BridgeAR/safe-stable-stringify) package configured with `{ bigint: false, strict: true, deterministic: true }`.

```ts
/**
 * Serialize a `SessionPayload` into a string suitable for signing on non-ETH chains.
 * The format is equivalent to JSON.stringify() with sorted object keys.
 */
declare function serializeSessionPayload(payload: SessionPayload): string

/**
 * Serialize an `ActionPayload` into a string suitable for signing on non-ETH chains.
 * The format is equivalent to JSON.stringify() with sorted object keys.
 */
declare function serializeActionPayload(payload: ActionPayload): string

/**
 * Get the hash identifier of an action or session.
 * Messages are identified by the sha256 hash of their canonical JSON serialization.
 */
declare function getMessageHash(message: Message): string
```