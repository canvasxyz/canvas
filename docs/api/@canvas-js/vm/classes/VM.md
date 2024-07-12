[Documentation](../../../packages.md) / [@canvas-js/vm](../index.md) / VM

# Class: VM

## Properties

### context

> `readonly` **context**: `QuickJSContext`

#### Defined in

[packages/vm/src/vm.ts:33](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L33)

***

### runtime

> `readonly` **runtime**: `QuickJSRuntime`

#### Defined in

[packages/vm/src/vm.ts:32](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L32)

***

### RUNTIME\_MEMORY\_LIMIT

> `static` **RUNTIME\_MEMORY\_LIMIT**: `number`

#### Defined in

[packages/vm/src/vm.ts:17](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L17)

## Methods

### cache()

> **cache**(`handle`): `QuickJSHandle`

#### Parameters

• **handle**: `QuickJSHandle`

#### Returns

`QuickJSHandle`

#### Defined in

[packages/vm/src/vm.ts:412](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L412)

***

### call()

> **call**(`fn`, `thisArg`, `args`): `QuickJSHandle`

#### Parameters

• **fn**: `string` \| `QuickJSHandle`

• **thisArg**: `string` \| `QuickJSHandle`

• **args**: `QuickJSHandle`[]

#### Returns

`QuickJSHandle`

#### Defined in

[packages/vm/src/vm.ts:134](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L134)

***

### callAsync()

> **callAsync**(`fn`, `thisArg`, `args`): `Promise`\<`QuickJSHandle`\>

#### Parameters

• **fn**: `string` \| `QuickJSHandle`

• **thisArg**: `string` \| `QuickJSHandle`

• **args**: `QuickJSHandle`[]

#### Returns

`Promise`\<`QuickJSHandle`\>

#### Defined in

[packages/vm/src/vm.ts:144](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L144)

***

### dispose()

> **dispose**(): `void`

Cleans up this VM instance.

#### Returns

`void`

#### Defined in

[packages/vm/src/vm.ts:48](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L48)

***

### execute()

> **execute**(`contract`, `options`): `void`

#### Parameters

• **contract**: `string`

• **options** = `{}`

• **options.uri?**: `string`

#### Returns

`void`

#### Defined in

[packages/vm/src/vm.ts:69](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L69)

***

### get()

> **get**(`path`): `QuickJSHandle`

#### Parameters

• **path**: `string`

#### Returns

`QuickJSHandle`

#### Defined in

[packages/vm/src/vm.ts:98](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L98)

***

### getBoolean()

> **getBoolean**(`handle`): `boolean`

#### Parameters

• **handle**: `QuickJSHandle`

#### Returns

`boolean`

#### Defined in

[packages/vm/src/vm.ts:194](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L194)

***

### getUint8Array()

> **getUint8Array**(`handle`): `Uint8Array`

#### Parameters

• **handle**: `QuickJSHandle`

#### Returns

`Uint8Array`

#### Defined in

[packages/vm/src/vm.ts:196](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L196)

***

### import()

> **import**(`contract`, `options`): `Promise`\<`QuickJSHandle`\>

#### Parameters

• **contract**: `string`

• **options** = `{}`

• **options.uri?**: `string`

#### Returns

`Promise`\<`QuickJSHandle`\>

#### Defined in

[packages/vm/src/vm.ts:75](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L75)

***

### is()

> **is**(`a`, `b`): `boolean`

#### Parameters

• **a**: `QuickJSHandle`

• **b**: `QuickJSHandle`

#### Returns

`boolean`

#### Defined in

[packages/vm/src/vm.ts:300](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L300)

***

### isArray()

> **isArray**(`handle`): `boolean`

#### Parameters

• **handle**: `QuickJSHandle`

#### Returns

`boolean`

#### Defined in

[packages/vm/src/vm.ts:303](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L303)

***

### isInstanceOf()

> **isInstanceOf**(`instanceHandle`, `classHandle`): `boolean`

#### Parameters

• **instanceHandle**: `QuickJSHandle`

• **classHandle**: `QuickJSHandle`

#### Returns

`boolean`

#### Defined in

[packages/vm/src/vm.ts:307](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L307)

***

### isUint8Array()

> **isUint8Array**(`handle`): `boolean`

#### Parameters

• **handle**: `QuickJSHandle`

#### Returns

`boolean`

#### Defined in

[packages/vm/src/vm.ts:313](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L313)

***

### newUint8Array()

> **newUint8Array**(`value`): `QuickJSHandle`

#### Parameters

• **value**: `Uint8Array`

#### Returns

`QuickJSHandle`

#### Defined in

[packages/vm/src/vm.ts:199](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L199)

***

### resolvePromise()

> **resolvePromise**(`promise`): `Promise`\<`QuickJSHandle`\>

Resolving promises inside QuickJS is tricky because you have to call
runtime.executePendingJobs() to get the promise to resolve, so you
can't use await syntax even though context.resolvePromise returns a
native Promise. This is a utility method that lets you use await.

#### Parameters

• **promise**: `QuickJSHandle`

#### Returns

`Promise`\<`QuickJSHandle`\>

#### Defined in

[packages/vm/src/vm.ts:120](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L120)

***

### setGlobalValues()

> **setGlobalValues**(`values`): `void`

#### Parameters

• **values**: `Record`\<`string`, `QuickJSHandle`\>

#### Returns

`void`

#### Defined in

[packages/vm/src/vm.ts:63](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L63)

***

### unwrapArray()

> **unwrapArray**\<`T`\>(`handle`, `map`?): `T`[]

Unwrap an array inside a QuickJS VM by one level,
returning a QuickJSHandle[] in the host environment.
`unwrapArray` does NOT dispose of the original handle.

#### Type Parameters

• **T** = `QuickJSHandle`

#### Parameters

• **handle**: `QuickJSHandle`

• **map?**

#### Returns

`T`[]

#### Defined in

[packages/vm/src/vm.ts:224](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L224)

***

### unwrapError()

> **unwrapError**(`handle`): [`VMError`](VMError.md)

#### Parameters

• **handle**: `QuickJSHandle`

#### Returns

[`VMError`](VMError.md)

#### Defined in

[packages/vm/src/vm.ts:157](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L157)

***

### unwrapFunction()

> **unwrapFunction**(`handle`, `thisArg`?): [`JSFunction`](../../utils/type-aliases/JSFunction.md)

#### Parameters

• **handle**: `QuickJSHandle`

• **thisArg?**: `QuickJSHandle`

#### Returns

[`JSFunction`](../../utils/type-aliases/JSFunction.md)

#### Defined in

[packages/vm/src/vm.ts:373](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L373)

***

### unwrapFunctionAsync()

> **unwrapFunctionAsync**(`handle`, `thisArg`?): [`JSFunctionAsync`](../../utils/type-aliases/JSFunctionAsync.md)

#### Parameters

• **handle**: `QuickJSHandle`

• **thisArg?**: `QuickJSHandle`

#### Returns

[`JSFunctionAsync`](../../utils/type-aliases/JSFunctionAsync.md)

#### Defined in

[packages/vm/src/vm.ts:396](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L396)

***

### unwrapObject()

> **unwrapObject**\<`T`\>(`handle`, `map`?): `Record`\<`string`, `T`\>

Unwrap an object inside a QuickJS VM by one level,
returning a Record<string, QuickJSHandle> in the host environment.
`unwrapObject` does NOT dispose of the original handle.

#### Type Parameters

• **T** = `QuickJSHandle`

#### Parameters

• **handle**: `QuickJSHandle`

• **map?**

#### Returns

`Record`\<`string`, `T`\>

#### Defined in

[packages/vm/src/vm.ts:261](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L261)

***

### unwrapResult()

> **unwrapResult**(`result`): `QuickJSHandle`

#### Parameters

• **result**: `VmCallResult`\<`QuickJSHandle`\>

#### Returns

`QuickJSHandle`

#### Defined in

[packages/vm/src/vm.ts:186](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L186)

***

### unwrapValue()

> **unwrapValue**(`handle`): [`JSValue`](../../utils/type-aliases/JSValue.md)

#### Parameters

• **handle**: `QuickJSHandle`

#### Returns

[`JSValue`](../../utils/type-aliases/JSValue.md)

#### Defined in

[packages/vm/src/vm.ts:315](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L315)

***

### wrapArray()

> **wrapArray**(`array`): `QuickJSHandle`

Wrap an array outside a QuickJS VM by one level,
returning a QuickJSHandle in the host environment.
`wrapArray` disposes all of its handle elements.

#### Parameters

• **array**: `QuickJSHandle`[]

#### Returns

`QuickJSHandle`

#### Defined in

[packages/vm/src/vm.ts:209](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L209)

***

### wrapError()

> **wrapError**(`err`): `QuickJSHandle`

#### Parameters

• **err**: `any`

#### Returns

`QuickJSHandle`

#### Defined in

[packages/vm/src/vm.ts:161](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L161)

***

### wrapFunction()

> **wrapFunction**(`fn`): `QuickJSHandle`

#### Parameters

• **fn**: [`JSFunction`](../../utils/type-aliases/JSFunction.md) \| [`JSFunctionAsync`](../../utils/type-aliases/JSFunctionAsync.md)

#### Returns

`QuickJSHandle`

#### Defined in

[packages/vm/src/vm.ts:335](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L335)

***

### wrapObject()

> **wrapObject**(`object`): `QuickJSHandle`

Wrap an object outside a QuickJS VM by one level,
returning a QuickJSHandle in the host environment.
`wrapObject` disposes all of its handle values.

#### Parameters

• **object**: `Record`\<`string`, `QuickJSHandle`\>

#### Returns

`QuickJSHandle`

#### Defined in

[packages/vm/src/vm.ts:247](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L247)

***

### wrapValue()

> **wrapValue**(`value`): `QuickJSHandle`

#### Parameters

• **value**: [`JSValue`](../../utils/type-aliases/JSValue.md)

#### Returns

`QuickJSHandle`

#### Defined in

[packages/vm/src/vm.ts:280](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L280)

***

### initialize()

> `static` **initialize**(`options`): `Promise`\<[`VM`](VM.md)\>

#### Parameters

• **options**: [`VMOptions`](../interfaces/VMOptions.md) = `{}`

#### Returns

`Promise`\<[`VM`](VM.md)\>

#### Defined in

[packages/vm/src/vm.ts:24](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/vm/src/vm.ts#L24)
