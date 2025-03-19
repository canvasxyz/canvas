# Forum Example

[Demo](https://forum-example.canvas.xyz/) - [Github](https://github.com/canvasxyz/canvas/tree/main/examples/forum)

The forum example implements a simple publishing platform.

## Server

Run `npm run dev:server` to start a temporary in-memory server, or
`npm run start:server` to persist data to a `.cache` directory.

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

## Deploying to Railway

Create a Railway space based on the root of this Github workspace (e.g. canvasxyz/canvas).

* Custom build command: `npm run build && VITE_CANVAS_WS_URL=wss://forum-example.canvas.xyz npm run build --workspace=@canvas-js/forum-example`
* Custom start command: `./install-prod.sh && canvas run /tmp/canvas-example-forum --port 8080 --static examples/forum/dist --topic forum-example.canvas.xyz --init examples/forum/src/contract.ts`
* Watch paths: `/examples/forum/**`
* Public networking:
  * Add a service domain for port 8080.
  * Add a service domain for port 4444.
* Watch path: `/examples/forum/**`. (Only build when forum code is updated, or a forum package is updated.)
