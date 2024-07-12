[Documentation](../../../packages.md) / [@canvas-js/utils](../index.md) / CacheMap

# Class: CacheMap\<K, V\>

## Extends

- `Map`\<`K`, `V`\>

## Type Parameters

• **K**

• **V**

## Constructors

### new CacheMap()

> **new CacheMap**\<`K`, `V`\>(`capacity`, `entries`?): [`CacheMap`](CacheMap.md)\<`K`, `V`\>

#### Parameters

• **capacity**: `number`

• **entries?**: `Iterable`\<[`K`, `V`]\>

Returns an iterable of key, value pairs for every entry in the map.

#### Returns

[`CacheMap`](CacheMap.md)\<`K`, `V`\>

#### Overrides

`Map<K, V>.constructor`

#### Defined in

[packages/utils/src/CacheMap.ts:5](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/utils/src/CacheMap.ts#L5)

## Properties

### \[toStringTag\]

> `readonly` **\[toStringTag\]**: `string`

#### Inherited from

`Map.[toStringTag]`

#### Defined in

node\_modules/typescript/lib/lib.es2015.symbol.wellknown.d.ts:137

***

### capacity

> `readonly` **capacity**: `number`

#### Defined in

[packages/utils/src/CacheMap.ts:6](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/utils/src/CacheMap.ts#L6)

***

### size

> `readonly` **size**: `number`

#### Inherited from

`Map.size`

#### Defined in

node\_modules/typescript/lib/lib.es2015.collection.d.ts:45

***

### \[species\]

> `readonly` `static` **\[species\]**: `MapConstructor`

#### Inherited from

`Map.[species]`

#### Defined in

node\_modules/typescript/lib/lib.es2015.symbol.wellknown.d.ts:319

## Methods

### \[iterator\]()

> **\[iterator\]**(): `IterableIterator`\<[`K`, `V`]\>

Returns an iterable of entries in the map.

#### Returns

`IterableIterator`\<[`K`, `V`]\>

#### Inherited from

`Map.[iterator]`

#### Defined in

node\_modules/typescript/lib/lib.es2015.iterable.d.ts:119

***

### clear()

> **clear**(): `void`

#### Returns

`void`

#### Inherited from

`Map.clear`

#### Defined in

node\_modules/typescript/lib/lib.es2015.collection.d.ts:20

***

### delete()

> **delete**(`key`): `boolean`

#### Parameters

• **key**: `K`

#### Returns

`boolean`

true if an element in the Map existed and has been removed, or false if the element does not exist.

#### Inherited from

`Map.delete`

#### Defined in

node\_modules/typescript/lib/lib.es2015.collection.d.ts:24

***

### entries()

> **entries**(): `IterableIterator`\<[`K`, `V`]\>

Returns an iterable of key, value pairs for every entry in the map.

#### Returns

`IterableIterator`\<[`K`, `V`]\>

#### Inherited from

`Map.entries`

#### Defined in

node\_modules/typescript/lib/lib.es2015.iterable.d.ts:124

***

### forEach()

> **forEach**(`callbackfn`, `thisArg`?): `void`

Executes a provided function once per each key/value pair in the Map, in insertion order.

#### Parameters

• **callbackfn**

• **thisArg?**: `any`

#### Returns

`void`

#### Inherited from

`Map.forEach`

#### Defined in

node\_modules/typescript/lib/lib.es2015.collection.d.ts:28

***

### get()

> **get**(`key`): `undefined` \| `V`

Returns a specified element from the Map object. If the value that is associated to the provided key is an object, then you will get a reference to that object and any change made to that object will effectively modify it inside the Map.

#### Parameters

• **key**: `K`

#### Returns

`undefined` \| `V`

Returns the element associated with the specified key. If no element is associated with the specified key, undefined is returned.

#### Inherited from

`Map.get`

#### Defined in

node\_modules/typescript/lib/lib.es2015.collection.d.ts:33

***

### has()

> **has**(`key`): `boolean`

#### Parameters

• **key**: `K`

#### Returns

`boolean`

boolean indicating whether an element with the specified key exists or not.

#### Inherited from

`Map.has`

#### Defined in

node\_modules/typescript/lib/lib.es2015.collection.d.ts:37

***

### keys()

> **keys**(): `IterableIterator`\<`K`\>

Returns an iterable of keys in the map

#### Returns

`IterableIterator`\<`K`\>

#### Inherited from

`Map.keys`

#### Defined in

node\_modules/typescript/lib/lib.es2015.iterable.d.ts:129

***

### set()

> **set**(`key`, `value`): [`CacheMap`](CacheMap.md)\<`K`, `V`\>

Adds a new element with a specified key and value to the Map. If an element with the same key already exists, the element will be updated.

#### Parameters

• **key**: `K`

• **value**: `V`

#### Returns

[`CacheMap`](CacheMap.md)\<`K`, `V`\>

#### Overrides

`Map.set`

#### Defined in

[packages/utils/src/CacheMap.ts:16](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/utils/src/CacheMap.ts#L16)

***

### values()

> **values**(): `IterableIterator`\<`V`\>

Returns an iterable of values in the map

#### Returns

`IterableIterator`\<`V`\>

#### Inherited from

`Map.values`

#### Defined in

node\_modules/typescript/lib/lib.es2015.iterable.d.ts:134
