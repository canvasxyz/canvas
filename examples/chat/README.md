# Chat Example

[Github Link](https://github.com/canvasxyz/canvas/tree/main/examples/chat) (`npm i && npm run dev` to run, hosted demo coming soon)

The simple chat example implements a public messaging room
with persistence over libp2p.

```ts
export const topic = "example-chat.canvas.xyz"

export const models = {
  message: {
    id: "primary",
    address: "string",
    content: "string",
    timestamp: "integer",
    $indexes: ["user", "timestamp"],
  },
}

export const actions = {
  async createMessage(db, { content }, { id, address, timestamp }) {
    await db.set("message", { id, address, content, timestamp })
  },
}
```
