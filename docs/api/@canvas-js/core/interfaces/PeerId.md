[Documentation](../../../packages.md) / [@canvas-js/core](../index.md) / PeerId

# Interface: PeerId

## Properties

### multihash

> **multihash**: `MultihashDigest`\<`number`\>

#### Defined in

node\_modules/@libp2p/interface/dist/src/peer-id/index.d.ts:22

***

### privateKey?

> `optional` **privateKey**: `Uint8Array`

#### Defined in

node\_modules/@libp2p/interface/dist/src/peer-id/index.d.ts:23

***

### publicKey?

> `optional` **publicKey**: `Uint8Array`

#### Defined in

node\_modules/@libp2p/interface/dist/src/peer-id/index.d.ts:24

***

### type

> **type**: `string`

#### Defined in

node\_modules/@libp2p/interface/dist/src/peer-id/index.d.ts:21

## Methods

### equals()

> **equals**(`other`?): `boolean`

#### Parameters

• **other?**: `string` \| `Uint8Array` \| [`PeerId`](PeerId.md)

#### Returns

`boolean`

#### Defined in

node\_modules/@libp2p/interface/dist/src/peer-id/index.d.ts:28

***

### toBytes()

> **toBytes**(): `Uint8Array`

#### Returns

`Uint8Array`

#### Defined in

node\_modules/@libp2p/interface/dist/src/peer-id/index.d.ts:27

***

### toCID()

> **toCID**(): `CID`\<`unknown`, `number`, `number`, `Version`\>

#### Returns

`CID`\<`unknown`, `number`, `number`, `Version`\>

#### Defined in

node\_modules/@libp2p/interface/dist/src/peer-id/index.d.ts:26

***

### toString()

> **toString**(): `string`

#### Returns

`string`

#### Defined in

node\_modules/@libp2p/interface/dist/src/peer-id/index.d.ts:25
