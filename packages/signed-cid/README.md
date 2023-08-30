# @canvas-js/signed-cid

This package implements a tiny signed data format for IPLD values. Any CID can be signed, and the resulting `Signature` can be passed around as an independent value on its own.

```ts
import type { CID } from "multiformats/cid"

export type SignatureType = "ed25519" | "secp256k1"

export type Signature = {
	type: SignatureType
	publicKey: Uint8Array // redundant for secp256k1 but still always included
	signature: Uint8Array
	cid: CID
}
```

The signature signs the bytes of the CID, which carries metadata about the encoding format and hashing algorithm, plus the hash of the encoded value itself. This allows `Signature` values to be redistributed via different codecs without breaking signature validation.

`ed25519` and `secp256k1` signatures are supported, using the audited [`@noble/curves`](https://github.com/paulmillr/noble-curves) library. `secp256k1` public keys are always compressed.

Only the `dag-json` and `dag-cbor` IPLD codecs are included by default, but others can be used by implementing the `Codec` interface. Similarly, only `sha2-256`, `blake3-256`, and `blake3-128` multihash digests are included by default, but other can be used by implementing the `Digest` interface.

## Usage

```ts
import { createSignature, verifySignature } from "@canvas-js/signed-cid"
import { ed25519 } from "@noble/curves"

const privateKey = ed25519.utils.randomPrivateKey()

const value = { foo: "hello world", bar: [1, 2, 3] }
const signature = createSignature("ed25519", privateKey, value)
console.log(signature)
// {
//   type: 'ed25519',
//   publicKey: Uint8Array(32) [ ... ],
//   signature: Uint8Array(64) [ ... ],
//   cid: CID(bafyreibqke43yd2rqll4nwlrbfjfqferamxp3sdia36a6awqvcae3cmm7a)
// }

verifySignature(signature, value) // throws an error if the signature is invalid
```

## API

### Sign

```ts
declare function createSignature(
	type: "ed25519" | "secp256k1",
	privateKey: Uint8Array,
	value: any,
	options: { codec?: string | Codec; digest?: string | Digest } = {}
): Signature
```

Defaults to `dag-cbor` and `sha2-256` if `options.codec` or `options.digest` are not provided, respectively.

### Verify

```ts
declare function verifySignature(
	{ type, publicKey, signature, cid }: Signature,
	value: any,
	options: { codecs?: Codec[]; digests?: Digest[] } = {}
): void
```

### Utility types

```ts
type Digest = { name: string; code: number; digest: (iter: Iterable<Uint8Array>) => Uint8Array }
type Codec = { name: string; code: number; encode: (value: any) => Iterable<Uint8Array> }
```

`Codec` and `Digest` are similar to some existing interfaces in the JavaScript IPLD ecosystem, but are defined the way they are here to support synchronous zero-copy streaming encoders.
