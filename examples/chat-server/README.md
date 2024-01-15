# @canvas-js/example-chat-server

This is an example of a replication server for the `chat-example.canvas.xyz` chat application.

## Local development

Run `npm run dev` to start a temporary in-memory server, or `npm run start` to persist data to a `.cache` directory.

## Deploying to Fly

If you're forking this example and/or running it with a different contract, be sure to edit `fly.toml` and change

- the Fly app name
- the `ANNOUNCE` environment variable to match your Fly app name
- the data source name (from `canvas_chat_data`) to your own Fly volume

Then deploy with

```
fly deploy
```

## Deploy multiple nodes

```
./deploy-chat-server.sh
```

## Running the Docker container locally

Mount a volume to `/data`. Set the `PORT`, `LISTEN`, `ANNOUNCE`, and `BOOTSTRAP_LIST` environment variables if appropriate.
