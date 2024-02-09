[Documentation](../../../index.md) / [@canvas-js/vm](../index.md) / VMError

# Class: VMError

## Extends

- `Error`

## Constructors

### new VMError(err)

> **new VMError**(`err`): [`VMError`](VMError.md)

#### Parameters

• **err**

• **err\.message**: `string`

• **err\.name**: `string`

• **err\.stack**: `string`

#### Returns

[`VMError`](VMError.md)

#### Overrides

`Error.constructor`

#### Source

[packages/vm/src/error.ts:2](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/error.ts#L2)

## Properties

### err

> **`private`** **`readonly`** **err**: `Object`

#### err.message

> **message**: `string`

#### err.name

> **name**: `string`

#### err.stack

> **stack**: `string`

#### Source

[packages/vm/src/error.ts:2](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/vm/src/error.ts#L2)

***

### message

> **message**: `string`

#### Inherited from

`Error.message`

#### Source

node\_modules/typescript/lib/lib.es5.d.ts:1076

***

### name

> **name**: `string`

#### Inherited from

`Error.name`

#### Source

node\_modules/typescript/lib/lib.es5.d.ts:1075

***

### stack?

> **`optional`** **stack**: `string`

#### Inherited from

`Error.stack`

#### Source

node\_modules/typescript/lib/lib.es5.d.ts:1077

***

### prepareStackTrace?

> **`static`** **`optional`** **prepareStackTrace**: (`err`, `stackTraces`) => `any`

Optional override for formatting stack traces

#### Parameters

• **err**: `Error`

• **stackTraces**: `CallSite`[]

#### Returns

`any`

#### See

https://v8.dev/docs/stack-trace-api#customizing-stack-traces

#### Inherited from

`Error.prepareStackTrace`

#### Source

node\_modules/@types/node/globals.d.ts:28

***

### stackTraceLimit

> **`static`** **stackTraceLimit**: `number`

#### Inherited from

`Error.stackTraceLimit`

#### Source

node\_modules/@types/node/globals.d.ts:30

## Methods

### captureStackTrace()

> **`static`** **captureStackTrace**(`targetObject`, `constructorOpt`?): `void`

Create .stack property on a target object

#### Parameters

• **targetObject**: `object`

• **constructorOpt?**: `Function`

#### Returns

`void`

#### Inherited from

`Error.captureStackTrace`

#### Source

node\_modules/@types/node/globals.d.ts:21
