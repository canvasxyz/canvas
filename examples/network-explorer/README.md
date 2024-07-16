# Network Explorer Example

## Running locally (for development)

To run the network explorer locally, you need to deploy three apps:
- The network-explorer server, which consists of a Canvas node plus a database index and some endpoints for exposing information about the network.
- The network-explorer client, which will query the server API and display the information.
- A Canvas app that produces events. In this example we will use the chat application in `examples/chat`. This will connect to the server over libp2p.

1. Start the server. In this directory run `npm run dev:server`. This will start a Canvas node and an API. By default the Canvas node listens on port 3334 and the API on port 3333.
2. Record the server's peer id. This is randomly assigned.
3. Start the network-explorer client. This is a frontend React/Vite app that queries. This accesses the API on port 3333 by default.
4. Start the chat app. In the `examples/chat` directory, run `VITE_BOOTSTRAP_LIST=/ip4/127.0.0.1/tcp/3334/ws/p2p/<server peer id> npm run dev`. This will host a chat app that is configured to connect to the server via libp2p on port 3334.


## Configuration

env vars:

- PORT (default 3333)
- LIBP2P_PORT
- DATABASE_URL
- NODE_ENV

server.ts:

- TOPICS

(todo: move to config.ts)
