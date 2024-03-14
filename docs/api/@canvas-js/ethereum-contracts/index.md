[Documentation](../../index.md) / @canvas-js/ethereum-contracts

# @canvas-js/ethereum-contracts

Contracts for onchain verification of Canvas messages created by the `EIP712Signer` verifiable signer.

### Usage

See `contracts/Contract_Test.sol` and `tests/Contract_Test.ts`.

### API

- `library CID`: Utilities.
  - `createDigest`: Creates a concatenated `<code><digest>` bytearray.
  - `encodeCID`: Creates a concatenated `<version><code><multihash>` bytearray.
- `library EIP712_Canvas`:
  - `verifySession`
  - `verifySessionMessage`
  - `verifySessionActionMessage`
- `contract CID_Test`: Exports CID functions for use in the test suite.
- `contract EIP712_Canvas_Test`: Exports EIP712 Canvas functions for use in the test suite.
