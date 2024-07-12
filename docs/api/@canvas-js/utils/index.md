[Documentation](../../packages.md) / @canvas-js/utils

# @canvas-js/utils

## API

### `assert`

```ts
export function assert(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message ?? "assertion failed")
  }
}
```

### `signalInvalidType`

```ts
export function signalInvalidType(type: never): never {
  console.error(type)
  throw new TypeError("internal error: invalid type")
}
```

### `mapEntries`

```ts
export const mapEntries = <K extends string, S, T>(object: Record<K, S>, map: (entry: [key: K, value: S]) => T) =>
  Object.fromEntries(Object.entries<S>(object).map(([key, value]) => [key, map([key as K, value])])) as Record<K, T>
```

### `mapKeys`

```ts
export const mapKeys = <K extends string, S, T>(object: Record<K, S>, map: (key: K) => T) =>
  Object.fromEntries(Object.entries<S>(object).map(([key, value]) => [key, map(key as K)])) as Record<K, T>
```

### `mapValues`

```ts
export const mapValues = <K extends string, S, T>(object: Record<K, S>, map: (value: S) => T) =>
  Object.fromEntries(Object.entries<S>(object).map(([key, value]) => [key, map(value)])) as Record<K, T>
```
