# Encrypted Chat Example

[Github Link](https://github.com/canvasxyz/canvas/tree/main/examples/encrypted-chat) (`npm i && npm run dev` to run, hosted demo coming soon)

This example implements simple private messaging for up to 2 people,
and can be easily extended to groups of up to tens of people.

Users derive an encryption key when they log into the application, by
signing a fixed message. [^1] The derived entropy is used to create an
Ethereum private key/address pair, and this address is published in
the `encryptionKeys` table.

Other users can see which users have registered to receive private
messages by inspecting the public table. Anyone holding the Ethereum
wallet can re-derive the encryption key by signing the same message.

Start a private chat by creating a 2-person encryption group:

- To create an encryption group, we generate another random private key,
  the group encryption key, which will be published in the `key` field
  of `encryptionGroups`.
- We encrypt the group encryption key, using each of the group members'
  individual encryption keys, and store it in `groupKeys`.
- Finally, we identify each encryption group by `id`, the
  lexicographically sorted, concatenated list of addresses in the group.

To send a message to a group, we encrypt it using the group key, and
publish it in the `privateMessages` table.

Note that this is a demo and does not include key rotation, forward
secrecy, privacy-preserving broadcast, or other useful properties that
are in protocols like Signal, Waku, and MLS.

[^1]: Ethereum wallets implement [RFC-6979](1) so signatures are
    deterministic. To be extra careful, you may want to ask the user
    for some additional entropy.

## Developing

TODO

- Run `npm run dev` to serve the frontend *only*, on port 5173.
- Run `npm run dev:server` to start the backend with in-memory temporary state, on port 8080.
- Run `npm run dev:server:persistent` to start the backend with data persisted to a directory in /tmp.
- Run `npm run dev:server:reset` to clear the data persistence directory in /tmp.

## Deploying to Railway

Create a Railway space based on the root of this Github workspace
(e.g. canvasxyz/canvas).

Set the railway config to `examples/encrypted-chat/railway.json`. This will
configure the start command, build command, and watch paths.

Configure networking for the application:
- Port 8080 should map to the websocket server defined in VITE_CANVAS_WS_URL (e.g. encrypted-chat-example.canvas.xyz).
- Port 4444 should map to a URL where your libp2p service will be exposed. (e.g. encrypted-chat-example-libp2p.canvas.xyz).

Configure environment variables:
- ANNOUNCE
- DATABASE_URL
- LIBP2P_PRIVATE_KEY
- DEBUG (optional, for logging)