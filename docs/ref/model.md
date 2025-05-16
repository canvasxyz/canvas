# Model API

Each application comes with a cross-platform relational database, based on [ModelDB](../api/modeldb.md).

## Model Properties

For detailed information on how to configure models and set up schemas, refer to the ModelDB documentation on [schemas](../api/modeldb.md#schemas) and [indexes](../api/modeldb.md#indexes).

Here is an abbreviated table of model property types:

| Property | Description |
|---------|-------------|
| `primary` | String primary key. You can also use `$primary` to define composite primary keys. |
| `number` | Number. |
| `integer` | Integer. |
| `float` | Floating-point number. |
| `string` | String. |
| `bytes` | Byte array. |
| `boolean` | Boolean. |
| `json` | Arbitrary JSON. |
| `@reference` | Reference to the primary key of another model. Foreign keys are not enforced. |
| `@relation[]` | One-to-many reference to the primary keys of another model. Stored as a separate table; foreign keys are not enforced. |

Any property may be made nullable by adding a `?` to the end of the property type.

At this time, nullable properties must still be provided as `null` when a database record is initialized using `db.create` or `db.set`.

## ModelAPI

The ModelAPI object is available inside actions, and includes APIs for reading and writing from the database, and declaring atomic transactions.

| Method | Description | Tx-only |
|---------|-------------|--------------|
| `id()` | Generates a unique 32-byte ID. | |
| `random()` | Generates a random number. | |
| `get(model, key)` | Retrieves a record from the database. | |
| `create(model, record)` | Creates or replaces a record. The primary key field is optional when calling create(). | |
| `set(model, record)` | Creates or replaces a record. | |
| `delete(model, key)` | Deletes a record. | |
| `update(model, record)` | Updates a record. Fetches the existing record, and writes back a shallow-merged record. | Yes |
| `merge(model, record)` | Updates a record. Fetches the existing record, and writes back a deep-merged record. | Yes |
| `link(modelPath, source, target)` | Adds a link to a relation between two models. | Yes |
| `unlink(modelPath, source, target)` | Removes a link from a relation between two models. | Yes |
| `transaction(callback)` | Executes operations in an rollback transaction. | |

See ModelAPI in the [API Types](../api/core.md#api) for more information.

## Notes on Transactional APIs

Transactional-only operations are always required to be run inside a `db.transaction()` block, and will roll back if any of the records they read from have changed.

Consider reviewing the [Transactions](./consistency.md#transactions) document to understand how this works.
