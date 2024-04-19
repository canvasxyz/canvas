[Documentation](../../../index.md) / [@canvas-js/signed-cid](../index.md) / verifySignedValue

# Function: verifySignedValue()

> **verifySignedValue**(`signature`, `value`, `options`): `void`

Verify that the signature is valid, and that signature.cid matches the given value

## Parameters

• **signature**: [`Signature`](../type-aliases/Signature.md)

• **value**: `any`

• **options**= `{}`

• **options\.codecs?**: [`Codec`](../type-aliases/Codec.md)[]

• **options\.digests?**: [`Digest`](../type-aliases/Digest.md)[]

• **options\.types?**: [`SignatureType`](../type-aliases/SignatureType.md)[]

## Returns

`void`

## Source

[signed-cid/src/verify.ts:23](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/signed-cid/src/verify.ts#L23)
