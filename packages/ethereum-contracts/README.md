# @canvas-js/ethereum-contracts

Contracts for onchain verification of Canvas messages created by the `EIP712Signer` verifiable signer.

### Usage

TODO

### Note on session message verification

Canvas is a CRDT/causal-graph environment where all operations are
represented on a log.

For purposes of uniformity, Session authorizations are wrapped and
signed with a valid session key (e.g. the one they just authorized)
before they are added to the log. Then, they're stored on the log
as `[Message, Signature]` tuples.

This allows every log entry to be represented as a `Message<Action |
Session>` rather than having separate types for Sessions and Actions.

To exhaustively verify that a message was correctly signed to be
appended to the log, you should verify that:

- A session key (e.g. did:key) was authorized by a user (e.g. did:eth, eip155:1:0x)
  in a `Session`. Sessions are verified using logic contained in the EIP712 signer.
- That authorization message was signed by a valid did:key, i.e. there exists a valid
  `Signature` corresponding to the session wrapped as a message: `Message<Session>`
- An action message was also signed by a valid did:key, i.e. there exists a valid
  `Signature` corresponding to the user's action wrapped as a message: `Message<Action>`

If the session key was appended to the log using a different did:key,
you should also verify the validity of that `did:key`.

This means it may be necessary to verify an arbitrarily long chain of
session authorizations for different `did:key` values, unless your
application enforces the invariant that any Sessions can only be
added to the log as `Message<Session>` using the did:key that they
just authorized.
