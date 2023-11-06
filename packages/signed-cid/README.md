# @canvas-js/signed-cid

This package implements a tiny signed data format for IPLD values. Any [CID](https://docs.ipfs.tech/concepts/content-addressing/) can be signed, and the resulting `Signature` can be passed around as an independent value on its own.

## Table of Contents

- [Overview](#overview)
- [Usage](#usage)
- [API](#api)
  - [Ed25519Signer](#ed25519signer)
  - [Secp256k1Signer](#secp256k1signer)
  - [Verify a signed value](#verify-a-signed-value)
  - [Verify a standalone signature](#verify-a-standalone-signature)
  - [Utility types](#utility-types)

## Overview

```ts
import type { CID } from "multiformats/cid"

export type Signature = {
  publicKey: string /** did:key URI */
  signature: Uint8Array
  cid: CID
}
```

Signature sign the **bytes of the CID**, which carries metadata about the encoding format and hashing algorithm in addition to the hash of the encoded value itself. This allows values and their signatures to be re-encoded with different codecs without breaking validation.

[`did:key` URIs](https://w3c-ccg.github.io/did-method-key/) are used to encode public keys.

Ed25519 and Secp256k1 signatures are supported, using the audited [`@noble/curves`](https://github.com/paulmillr/noble-curves) library. Secp256k1 public keys are always compressed.

The `dag-json`, `dag-cbor`, and `raw` IPLD codecs are supported by default, and others can be used by implementing the [`Codec`](#codec) interface. Similarly, `sha2-256`, `blake3-256`, and `blake3-128` multihash digests are supported by default, and others can be used by implementing the [`Digest`](#digest) interface.

## Usage

```ts
import { Ed25519Signer, verifySignedValue } from "@canvas-js/signed-cid"

const signer = new Ed25519Signer() // export the private key using `signer.export()`

const value = { foo: "hello world", bar: [1, 2, 3] }
const signature = signer.sign(value)
console.log(signature)
// {
//   publicKey: 'did:key:z6MkoTVvGXtN1Bjjd2dBMnaMNs2HFVzYkDZKNsMvVZCtaBep',
//   signature: Uint8Array(64) [
//     123,  77, 189, 225, 151, 159, 181,   5, 144, 130, 130,
//      58,  36, 189, 147, 133, 197, 194, 119, 116, 167, 215,
//     156,  18, 189,   6, 203, 156,  45,  40,  29, 215,  91,
//      47,  21,  44,  91,   9,  76,  79, 105,  75,  89, 144,
//      63, 198, 222, 175,  61, 131,  94,  20, 124,  91, 230,
//     149, 141,  43,   0, 207, 205,  76,   7,   9
//   ],
//   cid: CID(bafyreibqke43yd2rqll4nwlrbfjfqferamxp3sdia36a6awqvcae3cmm7a)
// }

verifySignedValue(signature, value) // throws an error if the signature is invalid
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

Signing defaults to `dag-cbor` and `sha2-256` if `options.codec` or `options.digest` are not provided, respectively.

### Ed25519Signer

```ts
export declare class Ed25519Signer<T = any> {
  public static type: "ed25519"
  public static code: number

  public readonly uri: string

  /**
   * @param privateKey 32-byte ed25519 private key
   */
  public constructor(privateKey?: Uint8Array)

  public sign(value: T, options?: { codec?: string | Codec; digest?: string | Digest }): Signature

  public export(): { type: "ed25519"; privateKey: Uint8Array }
}
```

### Secp256k1Signer

```ts
export declare class Secp256k1Signer<T = any> {
  public static type: "secp256k1"
  public static code: number

  public readonly uri: string

  /**
   * @param privateKey 33-byte secp256k1 private key
   */
  public constructor(privateKey?: Uint8Array)

  public sign(value: T, options?: { codec?: string | Codec; digest?: string | Digest }): Signature

  public export(): { type: "secp256k1"; privateKey: Uint8Array }
}
```

### Verify a signed value

```ts
export type SignatureType = "ed25519" | "secp256k1"

/**
 * Verify that the signature is valid, and that signature.cid matches the given value
 */
export declare function verifySignedValue(
  signature: Signature,
  value: any,
  options?: { types: SignatureType[]; codecs?: Codec[]; digests?: Digest[] }
): void
```

### Verify a standalone signature

```ts
/**
 * Verify that the signature is valid
 */
export declare function verifySignature(signature: Signature, options?: { types: SignatureType[] }): void
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
