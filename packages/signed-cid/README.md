# @canvas-js/signed-cid

This package implements a tiny signed data format for IPLD values. Any [CID](https://docs.ipfs.tech/concepts/content-addressing/) can be signed, and the resulting `Signature` can be passed around as an independent value on its own.

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

The signature signs the **raw bytes of the CID**, which carries metadata about the encoding format and hashing algorithm, plus the hash of the encoded value itself. This allows values and their signatures to be re-encoded with different codecs without breaking validation.

`ed25519` and `secp256k1` signatures are supported, using the audited [`@noble/curves`](https://github.com/paulmillr/noble-curves) library. `secp256k1` public keys are always compressed.

Only the `dag-json` and `dag-cbor` IPLD codecs are included by default, but others can be used by implementing the [`Codec`](#codec) interface. Similarly, only `sha2-256`, `blake3-256`, and `blake3-128` multihash digests are included by default, but other can be used by implementing the [`Digest`](#digest) interface.

## Usage

```ts
import { createSignature, verifySignature } from "@canvas-js/signed-cid"
import { ed25519 } from "@noble/curves/ed25519"

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

We can see a detailed breakdown of the CID in the signature with the CID explorer tool [here](https://cid.ipfs.tech/#bafyreibqke43yd2rqll4nwlrbfjfqferamxp3sdia36a6awqvcae3cmm7a). The prefix bytes of the CID tell us that it carries the sha2-256 hash of a dag-cbor value, and that the hash digest is `0x305139BC0F5182D7C6D9710952581491032EFDC86806FC0F02D0A8804D898CF8`.

We can check this by encoding and hashing the value ourselves:

```ts
import { encode } from "@ipld/dag-cbor"

const value = encode({ foo: "hello world", bar: [1, 2, 3] })
console.log(value)
// Uint8Array(25) [
//   162,  99,  98,  97, 114, 131,   1,
//     2,   3,  99, 102, 111, 111, 107,
//   104, 101, 108, 108, 111,  32, 119,
//   111, 114, 108, 100
// ]

const hash = crypto.createHash("sha256").update(value).digest()
console.log(hash)
// <Buffer 30 51 39 bc 0f 51 82 d7 c6 d9 71 09 52 58 14 91 03 2e fd c8 68 06 fc 0f 02 d0 a8 80 4d 89 8c f8>
```

Again, signatures always sign the raw bytes of the entire CID, not just the hash digest.

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
  signature: Signature,
  value: any,
  options: { codecs?: Codec[]; digests?: Digest[] } = {}
): void
```

### Utility types

`Codec` and `Digest` are similar to some existing interfaces in the JavaScript IPLD ecosystem, but are defined the way they are here to support synchronous zero-copy streaming encoders.

#### Digest

```ts
type Digest = { name: string; code: number; digest: (iter: Iterable<Uint8Array>) => Uint8Array }
```

#### Codec

```ts
type Codec = { name: string; code: number; encode: (value: any) => Iterable<Uint8Array> }
```
