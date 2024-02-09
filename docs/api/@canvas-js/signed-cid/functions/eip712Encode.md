[Documentation](../../../index.md) / [@canvas-js/signed-cid](../index.md) / eip712Encode

# Function: eip712Encode()

> **eip712Encode**(`message`): `Uint8Array`

Encode `Message<Action | Session>` using Ethereum typed data encoding.

Messages may contain dynamically typed data:
- Objects may contain strings, numbers, or booleans.
  These are encoded as `string`, `int256`, and `bool`.
- Numbers must be integers.
- 40-byte-long hex strings (starting with "0x") are encoded as `address`.

TODO: Objects encoded as `bytes` as `getBytes(AbiCoder().encode(types, values))`.
TODO: Null encoded as `bytes` with length zero.

While the codec is implemented for dynamically typed data, if you are
writing an onchain verifier for offchain signed data, it must still be
statically typed to a specific action schema beforehand. See
@canvas-js/ethereum-contracts for examples.

## Parameters

• **message**: [`Message`](../../gossiplog/type-aliases/Message.md)\<[`Action`](../../interfaces/type-aliases/Action.md) \| [`Session`](../../interfaces/type-aliases/Session.md)\>

## Returns

`Uint8Array`

## Source

[signed-cid/src/eip712.ts:24](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/signed-cid/src/eip712.ts#L24)
