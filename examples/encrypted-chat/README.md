# Encrypted Chat Example

[Demo](https://encrypted-chat-example.canvas.xyz) - [Github](https://github.com/canvasxyz/canvas/tree/main/examples/encrypted-chat)

This example implements simple private messaging, which can be extended to 10+ people.

## Developing

- Run `npm run dev` to serve the frontend, on port 5173.
- Run `npm run dev:server` to start the backend with in-memory temporary state, on port 8080.
- Run `npm run dev:server:persistent` to start the backend with data persisted to a directory in /tmp.
- Run `npm run dev:server:reset` to clear the persisted data.

## How it works

Users derive an encryption key when they log into the application, by
signing a fixed[^1] message. The derived entropy is used to create an
Ethereum private key pair, and the public address is published in
the `encryptionKeys` table.

To start a private chat, we create a 2-person encryption group:

- To create an encryption group, we generate a random private key,
  the group encryption key, whose public key will be published in the
  `key` field of `encryptionGroups`.
- We encrypt the group encryption key, using each of the group members'
  individual encryption keys, and store it in `groupKeys`.
- Each encryption group is identified by `id`, the lexicographically
  sorted, concatenated list of addresses in the group.

To send a message to a group, we encrypt it using the group key, and
publish it in the `privateMessages` table.

Other users can see which users have registered to receive private
messages by inspecting the public table. Anyone holding an Ethereum
wallet can re-derive their encryption key by signing the same message.

Note that this is a demo and does not include key rotation, forward
secrecy, privacy-preserving broadcast, or other properties of
private messaging protocols like Signal, Waku, and MLS.

[^1]: Ethereum wallets implement [RFC-6979](1) deterministic signatures.

## Deploying to Railway

Create a Railway space based on the root of this Github workspace
(e.g. canvasxyz/canvas).

Set the railway config to `examples/encrypted-chat/railway.json`. This will
configure the start command, build command, and watch paths.

Configure networking for the application:
- Port 8080 should map to the websocket server defined in VITE_CANVAS_WS_URL (e.g. encrypted-chat-example.canvas.xyz).
- Port 4444 should map to a URL where your libp2p service will be exposed. (e.g. encrypted-chat-example-libp2p.canvas.xyz).

Configure environment variables:
- ANNOUNCE (e.g. /dns4/encrypted-chat-example-libp2p.canvas.xyz/tcp/443/wss)
- DATABASE_URL
- LIBP2P_PRIVATE_KEY (try: node ./scripts/generateLibp2pPrivkey.js)
- DEBUG (optional, for logging)