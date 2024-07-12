[Documentation](../../../packages.md) / [@canvas-js/utils](../index.md) / Zip

# Type Alias: Zip\<E\>

> **Zip**\<`E`\>: `E` *extends* `Iterable`\<`any`\>[] ? `{ [k in keyof E]: E[k] extends Iterable<infer T> ? T : E[k] }` : `never`

## Type Parameters

• **E**

## Defined in

[packages/utils/src/zip.ts:1](https://github.com/canvasxyz/canvas/blob/62d177fb446565afa753f83091e84331fbd47245/packages/utils/src/zip.ts#L1)
