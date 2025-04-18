# Server-side Chat Example 🚧

This app demonstrates server-side rendered implementation of Canvas.

1. All signer state is stored on the frontend. Only signatures and signed actions are passed to the server, which handles all other Canvas-related functionality
2. Effects recieved on the server are persisted into a local or cloud Postgres database
3. Pages are served using NextJS for static generation

### Workspaces

This project uses NPM workspaces, and all commands are assumed to be executed in the root of the workspace. For commands specific to this chat project, use `-w` to specify the project name `@canvas-js/chat-next`

```
cd canvas/
npm run build
npm run build -w @canvas-js/chat-next
```

### Setup

You need a Postgres instance running locally or remotely that conforms to a standard `postgresql://` connection string. You can provide this string as a `DATABASE_URL` environment variable, or configure a local instance using the following credential format:

```
"postgresql://postgres:postgres@localhost:5432/chat_postgres":
  user: postgres
  password: postgres
  host: localhost
  port: 5432
  database_name: chat_postgres
```

- You need standard node and npm versions (node 18+)

### Run

To run, navigate to the root of the workspace and install dependencies:

- `npm i`

Run the development server for compiling Canvas runtime files:

- `npm run dev`

Finally, run the development server for this app:

- `npm run dev -w @canvas-js/chat-next`

### Build

To deploy remotely, you need to run (2) build steps and (1) command to start the server.

Make sure you have a valid Postgres connection string passed as `DATABASE_URL`.

1. Build the core `canvas` files in the root repo:

- `npm run build`

2. Build the NextJS-related files in the `chat-next` app:

- `npm run build -w @canvas-js/chat-next`

3. Run the production server:

- `npm run start -w @canvas-js/chat-next`

Open localhost:3000 with your browser to see the result
