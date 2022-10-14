# Canvas - Chat Client

This is an example web app using Canvas for a backend and Webpack on the front-end.

Make sure you have the Canvas CLI installed, and the local NPM dependencies installed with `npm i`.

### Developing

1. In one terminal, start a backend: `canvas run ../example-chat-server/spec.canvas.js`.
2. In another terminal, start the webpack development server with `npm run dev`.
3. Open the app at http://localhost:8080/

### Deploying to Fly.io

1. Make sure you have deployed the [example chat server](https://github.com/canvasxyz/canvas/tree/main/packages/example-chat-server).
2. Install [flyctl](https://fly.io/docs/speedrun/) and make sure you are logged in.
3. Inside `src/index.tsx`, change `host` to your instance of the example chat server.
4. Inside `fly.toml`, change `app` to your app name.
5. Run `flyctl deploy`.

(c) 2022 Canvas Technology Corporation
