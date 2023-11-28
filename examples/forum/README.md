# Forum/Arweave Example

[Github Link](https://github.com/canvasxyz/canvas/tree/main/examples/forum) (`npm i && npm run dev` to run, hosted demo coming soon)

The forum example implements a forum, with categories, tags,
threads/replies, and likes/upvotes.

Data is persisted on Arweave using Irys/Bundlr, and a custom
persister which loads past posts from an Irys endpoint.

```ts
const models = {
  categories: {
    name: "primary",
  },
  tags: {
    name: "primary",
  },
  threads: {
    id: "primary",
    title: "string",
    message: "string",
    address: "string",
    timestamp: "integer",
    category: "string",
    replies: "integer",
    $indexes: [["category"], ["address"], ["timestamp"]],
  },
  replies: {
    id: "primary",
    threadId: "@threads",
    reply: "string",
    address: "string",
    timestamp: "integer",
    $indexes: [["threadId"]],
  },
}

const actions = {
  createTag: (db, { tag }, { address, timestamp, id }) => {
    if (!tag || !tag.trim()) throw new Error()
    db.set("tags", { name: tag })
  },
  deleteTag: (db, { tag }, { address, timestamp, id }) => {
    db.delete("tags", tag)
  },
  createCategory: (db, { category }, { address, timestamp, id }) => {
    if (!category || !category.trim()) throw new Error()
    db.set("categories", { name: category })
  },
  deleteCategory: (db, { category }, { address, timestamp, id }) => {
    db.delete("categories", category)
  },
  createThread: (db, { title, message, category }, { address, timestamp, id }) => {
    if (!message || !category || !title || !message.trim() || !category.trim() || !title.trim()) throw new Error()
    db.set("threads", { id, title, message, category, address, timestamp, replies: 0 })
  },
  deleteMessage: async (db, { id }, { address, timestamp }) => {
    const message = await db.get("threads", id)
    if (!message || message.address !== address) throw new Error()
    db.delete("threads", id)
  },
  createReply: async (db, { threadId, reply }, { address, timestamp, id }) => {
    const thread = await db.get("threads", threadId)
    if (!thread || !threadId) throw new Error()
    db.set("threads", { ...thread, replies: (thread.replies as number) + 1 })
    db.set("replies", { id, threadId, reply, address, timestamp })
  },
  deleteReply: async (db, { replyId }, { address, timestamp, id }) => {
    const reply = await db.get("replies", replyId)
    if (!reply) throw new Error()
    const thread = await db.get("threads", reply.threadId as string)
    if (!thread) throw new Error()
    db.set("threads", { ...thread, replies: (thread.replies as number) - 1 })
    db.delete("replies", replyId)
  },
}
```
