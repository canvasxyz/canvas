# @canvas-js/chain-substrate

The Substrate session signer takes an injected `polkadot-js` extension, or generates a random Substrate keypair,
and uses it to authenticate a new session.

It also handles verification of messages matching this authentication method.

## Table of Contents

- [Installation](#installation)
- [API](#api)

## Installation

```
npm i @canvas-js/chain-atp
```

## API

```ts
import type { Signature, SessionSigner, Action, Message, Session } from "@canvas-js/interfaces"
import { InjectedExtension } from "@polkadot/extension-inject/types"
import { KeypairType } from "@polkadot/util-crypto/types"
import type { SubstrateSessionData } from "./types.js"
type SubstrateSignerInit = {
  sessionDuration?: number
  extension?: InjectedExtension
  substrateKeyType?: KeypairType
}
export declare class SubstrateSigner implements SessionSigner {
  constructor(init?: SubstrateSignerInit)
  readonly match: (address: string) => boolean
  verifySession(topic: string, session: Session): Promise<void>
  getSession(
    topic: string,
    options?: {
      chain?: string
      timestamp?: number
      fromCache?: boolean
    },
  ): Promise<Session<SubstrateSessionData>>
  sign(message: Message<Action | Session>): Signature
  clear(topic: string): Promise<void>
}
```
