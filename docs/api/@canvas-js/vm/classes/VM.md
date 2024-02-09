[Documentation](../../../index.md) / [@canvas-js/vm](../index.md) / VM

# Class: VM

## Constructors

### new VM(runtime, context, options)

> **`private`** **new VM**(`runtime`, `context`, `options`): [`VM`](VM.md)

#### Parameters

• **runtime**: `QuickJSRuntime`

• **context**: `QuickJSContext`

• **options**: [`VMOptions`](../interfaces/VMOptions.md)

#### Returns

[`VM`](VM.md)

#### Source

[packages/vm/src/vm.ts:30](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L30)

## Properties

### #globalCache

> **`private`** **`readonly`** **#globalCache**: `Map`\<`string`, `QuickJSHandle`\>

#### Source

[packages/vm/src/vm.ts:20](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L20)

***

### #localCache

> **`private`** **`readonly`** **#localCache**: `Set`\<`QuickJSHandle`\>

#### Source

[packages/vm/src/vm.ts:21](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L21)

***

### context

> **`readonly`** **context**: `QuickJSContext`

#### Source

[packages/vm/src/vm.ts:32](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L32)

***

### log

> **`private`** **`readonly`** **log**: `Logger`

#### Source

[packages/vm/src/vm.ts:18](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L18)

***

### runtime

> **`readonly`** **runtime**: `QuickJSRuntime`

#### Source

[packages/vm/src/vm.ts:31](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L31)

***

### RUNTIME\_MEMORY\_LIMIT

> **`static`** **RUNTIME\_MEMORY\_LIMIT**: `number`

#### Source

[packages/vm/src/vm.ts:16](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L16)

## Methods

### cache()

> **cache**(`handle`): `QuickJSHandle`

#### Parameters

• **handle**: `QuickJSHandle`

#### Returns

`QuickJSHandle`

#### Source

[packages/vm/src/vm.ts:411](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L411)

***

### call()

> **call**(`fn`, `thisArg`, `args`): `QuickJSHandle`

#### Parameters

• **fn**: `string` \| `QuickJSHandle`

• **thisArg**: `string` \| `QuickJSHandle`

• **args**: `QuickJSHandle`[]

#### Returns

`QuickJSHandle`

#### Source

[packages/vm/src/vm.ts:133](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L133)

***

### callAsync()

> **callAsync**(`fn`, `thisArg`, `args`): `Promise`\<`QuickJSHandle`\>

#### Parameters

• **fn**: `string` \| `QuickJSHandle`

• **thisArg**: `string` \| `QuickJSHandle`

• **args**: `QuickJSHandle`[]

#### Returns

`Promise`\<`QuickJSHandle`\>

#### Source

[packages/vm/src/vm.ts:143](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L143)

***

### dispose()

> **dispose**(): `void`

Cleans up this VM instance.

#### Returns

`void`

#### Source

[packages/vm/src/vm.ts:47](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L47)

***

### execute()

> **execute**(`contract`, `options`): `void`

#### Parameters

• **contract**: `string`

• **options**= `{}`

• **options\.uri?**: `string`

#### Returns

`void`

#### Source

[packages/vm/src/vm.ts:68](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L68)

***

### get()

> **get**(`path`): `QuickJSHandle`

#### Parameters

• **path**: `string`

#### Returns

`QuickJSHandle`

#### Source

[packages/vm/src/vm.ts:97](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L97)

***

### getBoolean()

> **getBoolean**(`handle`): `boolean`

#### Parameters

• **handle**: `QuickJSHandle`

#### Returns

`boolean`

#### Source

[packages/vm/src/vm.ts:193](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L193)

***

### getUint8Array()

> **getUint8Array**(`handle`): `Uint8Array`

#### Parameters

• **handle**: `QuickJSHandle`

#### Returns

`Uint8Array`

#### Source

[packages/vm/src/vm.ts:195](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L195)

***

### import()

> **import**(`contract`, `options`): `Promise`\<`QuickJSHandle`\>

#### Parameters

• **contract**: `string`

• **options**= `{}`

• **options\.uri?**: `string`

#### Returns

`Promise`\<`QuickJSHandle`\>

#### Source

[packages/vm/src/vm.ts:74](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L74)

***

### is()

> **is**(`a`, `b`): `boolean`

#### Parameters

• **a**: `QuickJSHandle`

• **b**: `QuickJSHandle`

#### Returns

`boolean`

#### Source

[packages/vm/src/vm.ts:299](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L299)

***

### isArray()

> **isArray**(`handle`): `boolean`

#### Parameters

• **handle**: `QuickJSHandle`

#### Returns

`boolean`

#### Source

[packages/vm/src/vm.ts:302](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L302)

***

### isInstanceOf()

> **isInstanceOf**(`instanceHandle`, `classHandle`): `boolean`

#### Parameters

• **instanceHandle**: `QuickJSHandle`

• **classHandle**: `QuickJSHandle`

#### Returns

`boolean`

#### Source

[packages/vm/src/vm.ts:306](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L306)

***

### isUint8Array()

> **isUint8Array**(`handle`): `boolean`

#### Parameters

• **handle**: `QuickJSHandle`

#### Returns

`boolean`

#### Source

[packages/vm/src/vm.ts:312](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L312)

***

### newUint8Array()

> **newUint8Array**(`value`): `QuickJSHandle`

#### Parameters

• **value**: `Uint8Array`

#### Returns

`QuickJSHandle`

#### Source

[packages/vm/src/vm.ts:198](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L198)

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

#### Source

[packages/vm/src/vm.ts:119](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L119)

***

### setGlobalValues()

> **setGlobalValues**(`values`): `void`

#### Parameters

• **values**: `Record`\<`string`, `QuickJSHandle`\>

#### Returns

`void`

#### Source

[packages/vm/src/vm.ts:62](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L62)

***

### unwrapArray()

> **unwrapArray**\<`T`\>(`handle`, `map`?): `T`[]

Unwrap an array inside a QuickJS VM by one level,
returning a QuickJSHandle[] in the host environment.
`unwrapArray` does NOT dispose of the original handle.

#### Type parameters

• **T** = `QuickJSHandle`

#### Parameters

• **handle**: `QuickJSHandle`

• **map?**

#### Returns

`T`[]

#### Source

[packages/vm/src/vm.ts:223](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L223)

***

### unwrapError()

> **unwrapError**(`handle`): [`VMError`](VMError.md)

#### Parameters

• **handle**: `QuickJSHandle`

#### Returns

[`VMError`](VMError.md)

#### Source

[packages/vm/src/vm.ts:156](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L156)

***

### unwrapFunction()

> **unwrapFunction**(`handle`, `thisArg`?): [`JSFunction`](../type-aliases/JSFunction.md)

#### Parameters

• **handle**: `QuickJSHandle`

• **thisArg?**: `QuickJSHandle`

#### Returns

[`JSFunction`](../type-aliases/JSFunction.md)

#### Source

[packages/vm/src/vm.ts:372](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L372)

***

### unwrapFunctionAsync()

> **unwrapFunctionAsync**(`handle`, `thisArg`?): [`JSFunctionAsync`](../type-aliases/JSFunctionAsync.md)

#### Parameters

• **handle**: `QuickJSHandle`

• **thisArg?**: `QuickJSHandle`

#### Returns

[`JSFunctionAsync`](../type-aliases/JSFunctionAsync.md)

#### Source

[packages/vm/src/vm.ts:395](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L395)

***

### unwrapObject()

> **unwrapObject**\<`T`\>(`handle`, `map`?): `Record`\<`string`, `T`\>

Unwrap an object inside a QuickJS VM by one level,
returning a Record`<string, QuickJSHandle>` in the host environment.
`unwrapObject` does NOT dispose of the original handle.

#### Type parameters

• **T** = `QuickJSHandle`

#### Parameters

• **handle**: `QuickJSHandle`

• **map?**

#### Returns

`Record`\<`string`, `T`\>

#### Source

[packages/vm/src/vm.ts:260](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L260)

***

### unwrapResult()

> **unwrapResult**(`result`): `QuickJSHandle`

#### Parameters

• **result**: `VmCallResult`\<`QuickJSHandle`\>

#### Returns

`QuickJSHandle`

#### Source

[packages/vm/src/vm.ts:185](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L185)

***

### unwrapValue()

> **unwrapValue**(`handle`): [`JSValue`](../type-aliases/JSValue.md)

#### Parameters

• **handle**: `QuickJSHandle`

#### Returns

[`JSValue`](../type-aliases/JSValue.md)

#### Source

[packages/vm/src/vm.ts:314](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L314)

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

#### Source

[packages/vm/src/vm.ts:208](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L208)

***

### wrapError()

> **wrapError**(`err`): `QuickJSHandle`

#### Parameters

• **err**: `any`

#### Returns

`QuickJSHandle`

#### Source

[packages/vm/src/vm.ts:160](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L160)

***

### wrapFunction()

> **wrapFunction**(`fn`): `QuickJSHandle`

#### Parameters

• **fn**: [`JSFunction`](../type-aliases/JSFunction.md) \| [`JSFunctionAsync`](../type-aliases/JSFunctionAsync.md)

#### Returns

`QuickJSHandle`

#### Source

[packages/vm/src/vm.ts:334](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L334)

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

#### Source

[packages/vm/src/vm.ts:246](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L246)

***

### wrapValue()

> **wrapValue**(`value`): `QuickJSHandle`

#### Parameters

• **value**: [`JSValue`](../type-aliases/JSValue.md)

#### Returns

`QuickJSHandle`

#### Source

[packages/vm/src/vm.ts:279](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L279)

***

### initialize()

> **`static`** **initialize**(`options`): `Promise`\<[`VM`](VM.md)\>

#### Parameters

• **options**: [`VMOptions`](../interfaces/VMOptions.md)= `{}`

#### Returns

`Promise`\<[`VM`](VM.md)\>

#### Source

[packages/vm/src/vm.ts:23](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/vm.ts#L23)
