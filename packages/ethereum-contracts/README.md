# @canvas-js/ethereum-contracts

Contracts for onchain verification of Canvas messages created by the `EIP712Signer` verifiable signer.

### Usage

See `contracts/Contract_Test.sol` and `tests/Contract_Test.ts`.

### API

- `library CID`: Utilities.
  - `createDigest` Creates a concatenated \<code>\<digest> bytearray.
  - `encodeCID` Creates a concatenated \<version>\<code>\<multihash> bytearray.
- `library EIP712_Canvas`
  - `verifySession`: Verify that the user's wallet authorized a Canvas session.
  - `verifyActionMessage` Verify that the user's Canvas session authorized an action to be added to the offchain log.
  - `verifySessionMessage`: Verify that the user's Canvas session authorized a message to add itself to the offchain log.
- `contract CID_Test`: Exports CID functions for use in the test suite.
- `contract EIP712_Canvas_Test`: Exports EIP712 Canvas functions for use in the test suite.

### Note on session message verification

Canvas is a *causal-log-native* runtime; session authorization messages
are signed with their own session key, before they are added to the log.
This allows Sessions and Actions to have a uniform interface in the log.

Applications that aren't strictly mirroring the log can skip verification
that the session message was signed, if onchain actions do not need to be
mirrorable back to the log. 

Do not do this if the onchain record is intended as a source of truth,
including if it maybe necessary to replicate the onchain log back offchain
in the future. Otherwise, the full history of actions submitted onchain
cannot be replicated offchain.

