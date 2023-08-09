# @canvas-js/signed-value

This package implements a tiny signed data format for the IPLD data model.

Any IPLD value can be signed. A signed value is an object of type `Signed<T>`.

```ts
import type { CID } from "multiformats/cid"

type Signed<T> = {
	type: "ed25519" | "secp256k1"
	publicKey: Uint8Array // redundant for secp256k1 but still always included
	signature: Uint8Array
	cid: CID
	value: T
}
```

The signature signs the CID, which carries metadata about the encoding format and hashing algorithm, plus the hash of the encoded value itself. This allows `Signed` values to be redistributed via different codecs without breaking signature validation.

`ed25519` and `secp256k1` signatures are supported, using the audited [`@noble/curves`](https://github.com/paulmillr/noble-curves) library. `secp256k1` public keys are always compressed.

Only the `dag-json` and `dag-cbor` IPLD codecs are included by default, but others can be used by implementing the `Codec` interface. Similarly, only the `sha2-256` multihash digest is included by default, but other can be used by implementing the `Digest` interface.

## API

### Sign

```ts
declare function createSignedValue<T>(
	type: "ed25519" | "secp256k1",
	privateKey: Uint8Array,
	value: T,
	options: { codec?: string | Codec; digest?: string | Digest } = {}
): Signed<T>
```

Defaults to `dag-cbor` and `sha2-256` if `options.codec` or `options.digest` are not provided, respectively.

### Verify

```ts
declare function verifySignedValue<T>(signed: Signed<T>, options: { codecs?: Codec[]; digests?: Digest[] } = {}): void
```

### Types

```ts
type Digest = { name: string; code: number; digest: (iter: Iterable<Uint8Array>) => Uint8Array }
type Codec<T> = { name: string; code: number; encode: (value: T) => Iterable<Uint8Array> }

type Signed<T> = {
	type: "ed25519" | "secp256k1"
	publicKey: Uint8Array // redundant for secp256k1 but still always included
	signature: Uint8Array
	cid: CID
	value: T
}
```

`Codec` and `Digest` are similar to some existing interfaces in the IPLD ecosystem, but are defined the way they are here to support zero-copy streaming encoders.
