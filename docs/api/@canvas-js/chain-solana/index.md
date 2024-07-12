[Documentation](../../packages.md) / @canvas-js/chain-solana

# @canvas-js/chain-solana

The Solana session signer takes an injected `SolanaWindowSigner`, provided by Solana wallets like Phantom,
and uses it to authenticate a new session.

It also handles verification of messages matching this authentication method.

## Table of Contents

- [Installation](#installation)
- [API](#api)

## Installation

```
npm i @canvas-js/chain-solana
```

## API

```ts
import solw3 from "@solana/web3.js"
import type { Signature, SessionSigner, Action, Message, Session } from "@canvas-js/interfaces"
import { SolanaSessionData } from "./types.js"
interface SolanaWindowSigner {
  publicKey?: solw3.PublicKey
  signMessage(message: Uint8Array): Promise<{
    signature: Uint8Array
  }>
}
export interface SolanaSignerInit {
  chainId?: string
  signer?: SolanaWindowSigner
  sessionDuration?: number
}
export declare class SolanaSigner implements SessionSigner {
  constructor({ signer, sessionDuration, chainId }?: SolanaSignerInit)
  readonly match: (chain: string) => boolean
  verifySession(topic: string, session: Session): void
  getSession(
    topic: string,
    options?: {
      timestamp?: number
      fromCache?: boolean
    },
  ): Promise<Session<SolanaSessionData>>
  sign(message: Message<Action | Session>): Signature
  clear(topic: string): Promise<void>
}
```
