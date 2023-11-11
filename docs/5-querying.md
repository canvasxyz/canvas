# Querying the database

You can only write to the database inside an action handler, but you can query it outside action handlers by using `app.db.get("model")`, `app.db.query("model")`, or `useLiveQuery` for live-updating data.

(See the "Actions" section to learn about reading the database inside action handlers.)

## Getting individual records

All database models have a primary key, defined in the model schema using the `"primary"` type. You can look up individual records by primary key using `app.db.get`.

```ts
const app = await Canvas.initialize({
  contract: {
    topic: "com.example.my-app",
    models: {
      posts: {
        id: "primary",
        user: "string",
        content: "string",
        updated_at: "integer",
      },
    },
    actions: { ... }
  },
})

const { id: idA } = await app.actions.createPost({ content: "foo" }) // 08arkku017tl90n9dptlkkd62vooji11
const { id: idB } = await app.actions.createPost({ content: "bar" }) // 0cfag48t05mags2lhdt9idn3cbpubl1e
const { id: idC } = await app.actions.createPost({ content: "baz" }) // 0j77pkoundspspv1dgkppvceduu8s2t1

await app.db.get("posts", idA)
// {
//   id: '08arkku017tl90n9dptlkkd62vooji11',
//   user: 'eip155:1:0x8A876c44064b77b36Cb3e0524DeeC1416858bDE6',
//   content: 'foo',
//   updated_at: 1698344798345
// }
```

## Queries

The `app.db.query` method supports more expressive queries, including `select`, `where`, `orderBy`, `limit`, and `offset` clauses.

```ts
type QueryParams = {
  select?: Record<string, boolean>
  where?: WhereCondition
  orderBy?: Record<string, "asc" | "desc">
  limit?: number
  offset?: number
}

type WhereCondition = Record<string, PropertyValue | NotExpression | RangeExpression>
type NotExpression = { neq: PropertyValue }
type RangeExpression = { gt?: PrimitiveValue; gte?: PrimitiveValue; lt?: PrimitiveValue; lte?: PrimitiveValue }

type PrimitiveValue = null | string | number | Uint8Array
type PropertyValue = null | string | number | Uint8Array | string[]
```

```ts
// Get all posts
const results = await app.db.query("posts", {})

// [
//   {
//     id: '08arkku017tl90n9dptlkkd62vooji11',
//     user: 'eip155:1:0x8A876c44064b77b36Cb3e0524DeeC1416858bDE6',
//     content: 'foo',
//     updated_at: 1698344798345
//   },
//   {
//     id: '0cfag48t05mags2lhdt9idn3cbpubl1e',
//     user: 'eip155:1:0x8A876c44064b77b36Cb3e0524DeeC1416858bDE6',
//     content: 'bar',
//     updated_at: 1698344798363
//   },
//   {
//     id: '0j77pkoundspspv1dgkppvceduu8s2t1',
//     user: 'eip155:1:0x8A876c44064b77b36Cb3e0524DeeC1416858bDE6',
//     content: 'baz',
//     updated_at: 1698344798366
//   }
// ]
```

```ts
// Get all posts, sorted by timestamp
const results = await app.db.query("posts", {
  select: { id: true, content: true },
  orderBy: { updated_at: "desc" },
})

// [
//   { id: '0j77pkoundspspv1dgkppvceduu8s2t1', content: 'baz' },
//   { id: '0cfag48t05mags2lhdt9idn3cbpubl1e', content: 'bar' },
//   { id: '08arkku017tl90n9dptlkkd62vooji11', content: 'foo' },
// ]
```

```ts
// Get all posts, filtering by a range expression on `content`
const results = await app.db.query("posts", {
  select: { id: true, content: true },
  where: { content: { lte: "eee" } },
})

// [
//   { id: '0cfag48t05mags2lhdt9idn3cbpubl1e', content: 'bar' },
//   { id: '0j77pkoundspspv1dgkppvceduu8s2t1', content: 'baz' },
// ]
```

## Subscribing to live queries in React

You can also subscribe to queries in the browser using the `useLiveQuery` hook exported from `@canvas-js/hooks`.

```tsx
import { useCanvas, useLiveQuery } from "@canvas-js/hooks"

const contract = {
  topic: "com.example.my-app",
  models: { ... },
  actions: {
    async createPost(db, args, {}) { ... }
    async deletePost(db, args, {}) { ... }
  }
}

const MyComponent = (props: {}) => {
  const { app, error } = useCanvas({ contract })

  const posts = useLiveQuery(app, "posts", { limit: 10, orderBy: { updated_at: "desc" } })
  return (
    <div>
      {posts.map((post) => <div id={post.id}>{post.content}</div>)}
    </div>
  )
}
```
