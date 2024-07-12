[Documentation](../../packages.md) / @canvas-js/ethereum-contracts

# @canvas-js/ethereum-contracts

Contracts for onchain verification of Canvas messages created by the `EIP712Signer` verifiable signer.

### Usage

TODO

### How it works

Canvas is a CRDT/causal-graph environment where all operations are
represented on a log.

Every log entry is a signed `[Message<Action | Session>, Signature]`
tuple.

For example, a `Session` authorizes a new session key (did:key) and is
serialized as a `Message<Session>`, which is then signed by the
did:key that was authorized to create a `Signature`.

To exhaustively verify that a message was correctly signed to be
appended to the log, you should verify that:

- A session key (e.g. did:key) was authorized by a user (e.g. did:pkh:eip155:1:0x123...)
  in a `Session`. Sessions are verified using logic in the EIP712 signer.
- That authorization message was signed by the did:key it authoriaed, i.e. there exists a
  `Signature` corresponding to the session wrapped as a message `Message<Session>`.
- An action message was also signed by that did:key, i.e. there exists a valid
  `Signature` corresponding to the user's action wrapped as a message `Message<Action>`.
