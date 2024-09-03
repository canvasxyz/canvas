# Chat Example

[Demo](https://canvas-chat.pages.dev/) - [Github](https://github.com/canvasxyz/canvas/tree/main/examples/chat)

The simple chat example implements a public messaging room
with persistence over libp2p.

```ts
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

## Server

Run `npm run server:dev` to start a temporary in-memory server, or
`npm run server:start` to persist data to a `.cache` directory.

To deploy the replication server:

```
$ cd server
$ fly deploy
```

If you are forking this example, you should change:

- the Fly app name
- the `ANNOUNCE` environment variable to match your Fly app name

## Running the Docker container locally

Mount a volume to `/data`. Set the `PORT`, `LISTEN`, `ANNOUNCE`, and
`BOOTSTRAP_LIST` environment variables if appropriate.
