# Chat Example

[Demo](https://canvas-chat.pages.dev/) - [Github](https://github.com/canvasxyz/canvas/tree/main/examples/chat)

The simple chat example implements a public messaging room
with persistence over libp2p.

```ts
export const topic = "chat-example.canvas.xyz"

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

## Multiple Topics

You can also run this application across multiple topics. This allows
each instance of the application to sync separately.

Try playing with [this example](https://mud-example.vercel.app), with source code
[available here](https://github.com/canvasxyz/mud-example).