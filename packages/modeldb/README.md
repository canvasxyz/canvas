# @canvas-js/modeldb

ModelDB is a minimalist cross-platform relational database wrapper. It currently supports the following backends:

- IndexedDB (browser)
- SQLite + WASM (browser) with either an OPFS store or transient in-memory storage
- PostgreSQL (NodeJS)
- Native SQLite (NodeJS)
- Native SQLite (React Native with Expo)
- Durable Objects (Cloudflare) (experimental, not officially supported)

## Table of Contents

- [Usage](#usage)
  - [Initialization](#initialization)
  - [Schemas](#schemas)
  - [Setting and deleting records](#setting-and-deleting-records)
  - [Queries](#queries)
  - [Indexes](#indexes)
  - [Upgrades](#upgrades)
  - [Name restrictions](#name-restrictions)
- [Testing](#testing)
- [License](#license)

## Usage

### Initialization

Import `ModelDB` from:

- `@canvas-js/modeldb-idb` (browser)
- `@canvas-js/modeldb-sqlite-wasm` (browser)
- `@canvas-js/modeldb-pg` (NodeJS)
- `@canvas-js/modeldb-sqlite` (NodeJS)
- `@canvas-js/modeldb-sqlite-expo` (React Native)
- `@canvas-js/modeldb-durable-objects` (Durable Objects)

or any other backend.

```ts
import { ModelDB } from "@canvas-js/modeldb-sqlite"

const db = await ModelDB.init({
  path: "/path/to/db.sqlite", // set `path: null` for an in-memory database
  models: { ... }
})
```

```ts
import { ModelDB } from "@canvas-js/modeldb-idb"

const db = await ModelDB.init({
  name: "my-database-name", // used as the IndexedDB database name
  models: { ... }
})
```

For more initialization examples, see the `test` directory in each subpackage.

### Schemas

Databases are configured with a `models` schema, provided as a JSON DSL. Every model has a mandatory string primary key and supports nullable and non-nullable `integer`, `float`, `string` and `bytes` datatypes. It also supports a non-nullable `json` datatype.

```ts
const db = await ModelDB.init({
  models: {
    user: {
      // exactly one "primary" property is required
      id: "primary",
      // properties are non-null by default
      name: "string",
      // declare nullable properties using `?`
      birthday: "string?",
      // json data is also supported
      metadata: "json",
    },
  },
})

await db.set("user", { id: "xxx", name: "John", birthday: "1990-01-01", metadata: {} })
await db.set("user", { id: "xxx", name: "John Doe", birthday: "1990-01-01", metadata: { home: "New York" } })
await db.get("user", "xxx") // { id: "xxx", name: "John Doe", birthday: "1990-01-01", metadata: { home: "New York" } }
```

Reference properties (`@user` with `string` values), nullable reference properties (`@user?` with `string | null` values), and relation properties (`@user[]` with `string[]` values) are also supported, although the foreign key constraint is **not enforced**.

```ts
const db = await ModelDB.init({
  models: {
    user: {
      user_id: "primary",
      name: "string",
    },
    room: {
      room_id: "primary",
      members: "@user[]",
    },
    message: {
      message_id: "primary",
      user: "@user",
      content: "string",
      timestamp: "integer",
    },
  },
})
```

### Setting and deleting records

Mutate the database using either the `set` and `delete` methods, or the lower-level `apply` method to batch operations in an atomic transaction:

```ts
await db.set("user", { user_id: "xxx", name: "John Doe" })
await db.set("user", { user_id: "yyy", name: "Jane Doe" })
await db.delete("user", "xxx")

await db.apply([
  { model: "user", operation: "set", value: { user_id: "xxx", name: "John Doe" } },
  { model: "user", operation: "set", value: { user_id: "yyy", name: "Jane Doe" } },
  { model: "user", operation: "delete", key: "xxx" },
])
```

### Queries

Access data using the `query` method, or use the `get` to retrieve records by primary key.

```ts
await db.set("user", { user_id: "a", name: "Alice" })
await db.set("user", { user_id: "b", name: "Bob" })
await db.set("user", { user_id: "c", name: "Carol" })

await db.get("user", "a") // { user_id: "a", name: "Alice" }
await db.get("user", "d") // null

await db.query("user", { where: { user_id: { gte: "b" } } })
// [
//   { user_id: "b", name: "Bob" },
//   { user_id: "c", name: "Carol" },
// ]
```

Queries support `select`, `where`, `orderBy`, and `limit` expressions. `where` conditions can have equality, inequality, and range terms.

```ts
export type QueryParams = {
  select?: Record<string, boolean>
  where?: WhereCondition
  orderBy?: Record<string, "asc" | "desc">
  limit?: number
  offset?: number
}

export type WhereCondition = Record<string, PropertyValue | NotExpression | RangeExpression>
export type NotExpression = {
  neq: PropertyValue
}

export type RangeExpression = {
  gt?: PrimitiveValue
  gte?: PrimitiveValue
  lt?: PrimitiveValue
  lte?: PrimitiveValue
}
```

### Indexes

By default, queries translate into filters applied to a full table scan. You can create indexes using the special `$indexes: string[]` property:

```ts
const db = await ModelDB.init({
  models: {
    ...
    message: {
      message_id: "primary",
      user: "@user",
      content: "string",
      timestamp: "integer",
      $indexes: ["timestamp"]
    },
  },
})

// this will use the `timestamp` index to avoid a full table scan
const recentMessages = await db.query("message", { orderBy: { timestamp: "desc" }, limit: 10 })
```

Multi-property index support will be added soon.

### Upgrades

It is now possible to specify a version number for each of your databases, and automatically run programmatic upgrades between versions.

TODO: Explain upgrade usage and version conventions.

```ts
const db = await ModelDB.open(uri, {
  models,
  version, // e.g. { myapp: 3 }
  upgrade: async (upgradeAPI, oldConfig, oldVersion, newVersion) => {
    // Execute your upgrade here using upgradeAPI.
  },
  initialUpgradeSchema: Object.assign(init.initialUpgradeSchema ?? { ...models }, initialUpgradeSchema),
  initialUpgradeVersion: Object.assign(init.initialUpgradeVersion ?? { ...version }, initialUpgradeVersion),
})
```

```ts
export interface ModelDBInit {
  models: ModelSchema

  version?: Record<string, number>
  upgrade?: DatabaseUpgradeCallback
  initialUpgradeVersion?: Record<string, number>
  initialUpgradeSchema?: ModelSchema

  clear?: boolean
}

export interface DatabaseUpgradeAPI extends DatabaseAPI {
  createModel(name: string, init: ModelInit): Awaitable<void>
  deleteModel(name: string): Awaitable<void>

  addProperty(
    modelName: string,
    propertyName: string,
    propertyType: PropertyType,
    defaultPropertyValue: PropertyValue,
  ): Awaitable<void>
  removeProperty(modelName: string, propertyName: string): Awaitable<void>

  addIndex(modelName: string, index: string): Awaitable<void>
  removeIndex(modelName: string, index: string): Awaitable<void>
}
```

### Name restrictions

Model names and property names can contain `[a-zA-Z0-9$:_\-\.]`.

## Testing

ModelDB has a test suite that uses Ava as its test runner and
Puppeteer for browser testing.

The SQLite + Wasm implementations use Web APIs and are tested in the
browser.

The IndexedDB implementation is tested in NodeJS using a mock
IndexedDB implementation.

```sh
npm run test --workspace=@canvas-js/modeldb
```

## License

MIT © Canvas Technologies, Inc.
