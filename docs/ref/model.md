# Model API

Each application comes with a cross-platform relational database, based on [ModelDB](../api/modeldb.md).

ModelDB supports these types in the database:

| Type | Description |
|----------|-------------|
| `primary` | String primary key. |
| `number` | Number. |
| `integer` | Integer. |
| `float` | Floating-point number. |
| `string` | String. |
| `bytes` | Byte array. |
| `boolean` | Boolean. |
| `json` | Arbitrary JSON. |
| `@reference` | Reference to the primary key of another model. Foreign keys are not enforced. |
| `@relation[]` | One-to-many reference to the primary keys of another model. Stored as a separate table internally. Foreign keys are not enforced. |

Any property may be made nullable by adding a `?` to the end of the property type.
Nullable properties must be provided as `null` when a database record is initialized using `db.create` or `db.set` - they aren't *optional*.

Additionally, each database table can specify these special properties:

| Property | Description |
|----------|-------------|
| `$indexes` | A list of indexes on the database. |
| `$primary` | The primary key, if no `primary` type is provided. Provide a list of keys to create a composite primary key. |
| `$rules` | An optional `{ create, update, delete }` object that defines permissions on the database. Can only be used in [model-based contracts](contract#contracts-with-permissions), not on class contracts. |

For full details, refer to the ModelDB documentation for [schemas](../api/modeldb.md#schemas) and
[indexes](../api/modeldb.md#indexes).

## ModelAPI

The ModelAPI object is available inside actions, and includes APIs for reading and writing from the database, and managing transactions.

| Method | Description | Tx-only |
|---------|-------------|--------------|
| `id()` | Generates a unique 32-byte ID, using client-side PRNG. | |
| `random()` | Generates a random number, using client-side PRNG. | |
| `get(model, key)` | Retrieves a record from the database. | |
| `create(model, record)` | Creates or replaces a record. The primary key field is optional when calling create(). | |
| `set(model, record)` | Creates or replaces a record. | |
| `delete(model, key)` | Deletes a record. | |
| `update(model, record)` | Updates a record. Fetches the existing record, and writes back a shallow-merged record. | Yes |
| `merge(model, record)` | Updates a record. Fetches the existing record, and writes back a deep-merged record. | Yes |
| `link(modelPath, source, target)` | Adds a link to a relation between two models. | Yes |
| `unlink(modelPath, source, target)` | Removes a link from a relation between two models. | Yes |
| `transaction(callback)` | Executes operations in an rollback transaction. | |

Link and unlink operations are called with a syntax like:

`this.db.link("game.player", gameId, playerId)`

See ModelAPI in the [API Types](../api/core.md#api) for more information.

## Transactional-only operations

Transactional-only operations must run inside a `db.transaction()` block. They will roll back if any of the records they read from have changed.

See [Transactions](./consistency.md#transactions) to understand how this works.
