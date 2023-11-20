# Chat Example

LINK TBD

The simple chat example implements a public messaging room
with persistence over libp2p.

```ts
export const topic = "example-chat.canvas.xyz";

export const models = {
  message: {
    id: "primary",
    address: "string",
    content: "string",
    timestamp: "integer",
    $indexes: ["user", "timestamp"],
  },
};

export const actions = {
  async createMessage(db, { content }, { id, address, timestamp }) {
    await db.message.set({ id, address, content, timestamp });
  },
};
```
