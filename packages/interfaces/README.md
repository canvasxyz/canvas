# @canvas-js/interfaces

This package exports TypeScript types for Canvas messages and other interfaces.

## Table of Contents

- [Messages](#messages)
  - [Sessions](#sessions)
  - [Actions](#actions)
- [Models](#models)

## Messages

A _message_ is an entry in a GossipLog log.

```ts
export type Message<Payload> = {
  topic: string
  clock: number
  parents: string[]
  payload: Payload
}
```

Canvas apps on two types of messages: _actions_ and _sessions_. Actions are signed function calls that are evaluated by the contract; sessions are used to authorize emphemeral keys to sign actions on behalf of users.

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

    sessionAddress: string // public address of the delegate key
    sessionDuration: number // duration in milliseconds
    sessionIssued: number // issue time in milliseconds since 1 January 1970 00:00:00 UTC

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
  id: "string"
  updated_at: "datetime"
  indexes?: Index[]
} & Record<string, ModelType>
```
