# Deploying an Application

You can run Canvas applications in the browser only, or using
browser-to-server sync with a server peer.

## Browser applications

For a browser application, we'll create a separate `contract.ts`
file and import it.

```ts
import type { ModelSchema, Actions } from "@canvas-js/core"

export const models = {
  foo: { id: "primary" }
} satisfies ModelSchema

export const actions = {
  doThing: () => { ... }
} satisfies Actions<typeof models>
```

The `satisfies` keyword is optional, but will ensure that you can
get type completions when working with the application later.

Now, import this contract from our frontend:

```ts
import { useCanvas } from "@canvas-js/hooks"
import { models, actions } from "./contract.js"

export const App = () => {
  const { app, ws } = useCanvas(null, {
    contract: { models, actions },
    topic: "example.xyz",
  })

  const items = useCanvas(app, "items")
  // ...
}
```

We've initialized the `useCanvas` hook with a `null` first parameter,
instead of a WebSocket URL. As a result, the application won't try to
sync to a server WebSocket, and will persist in the browser until
IndexedDB is cleared.

## CLI application

To run a temporary development node for this application, we can use
the `contract.ts` file which we created above:

```sh
npm install -g @canvas-js/cli
canvas run contract.ts --topic example.xyz

[canvas] Bundled .ts contract: 4386 chars
[canvas] ✦ Running app in-memory only. No data will be persisted.
[canvas] Starting app with topic example.xyz
[canvas] Using PeerId 12D3KooWJg3fWcjrkCmCsca2Z5uS9BPmccCazk3fFhjED13ejuoz
[canvas] Listening on ...
[canvas] Connect browser clients to ws://localhost:8000
[canvas] Serving HTTP API: ...
```

This will start the application on localhost:8000.

If you provide `--network-explorer`, the CLI will also expose a
management interface at localhost:8000/explorer, which will show you
data and past actions stored on the replica.

If you provide `--network-explorer --admin <ethAddr>`, you will be
able to change the currently running contract from the explorer by
signing a message with your address. This will cause the instance to
terminate and start over again.

If you provide `--init contract.ts /data/canvas-example` instead, the
local node will make a copy of the contract and store it in the data
directory you've provided. This will ensure that application data
persists when the CLI is shut down.

```
canvas run \
  --topic example.xyz \
  --init contract.ts /data/canvas-example
```

If you would prefer to use Postgres as a backing database, create a
local Postgres DB and provide its URL as an environment variable as
well. The data directory will only be used to store metadata.

```
DATABASE_URL="postgres://localhost:5432/..." canvas run \
  --topic example.xyz \
  --init contract.ts /data/canvas-example
```

## CLI application with snapshot

When you restart a server using the admin key, you have the option to
restart the application's data from scratch, or keep the existing data
as a flattened "snapshot". (Snapshots are not verifiable by end-users,
and are like hard forks.)

Creating a snapshot causes the server to append a #hash to the end of
your topic, so an topic like `chat-example.canvas.xyz` would become:

```
chat-example.canvas.xyz#ffae63ab95cc5483
```

This topic will *not* sync with applications on the topic
`chat-example.canvas.xyz`.

If you want to run a browser application that follows the snapshot,
you should use the `useCanvas` hook with a WebSocket URL, but do not
provide a contract or topic.

```ts
import { useCanvas } from "@canvas-js/hooks"
import { models, actions } from "./contract.js"

export const App = () => {
  const { app, ws } = useCanvas<typeof models, typeof actions>(
    "ws://localhost:8080"
  )
  // app.actions.doThing()
  // await app.db.get("foo", id)
}
```

The browser will download the latest snapshot, contract, and topic from the
remote application.

## Production deployment

Deploying to a production server is similar to running a local server.

### Without server-to-server sync

If you don't need server-to-server libp2p sync for our applications,
then you can just upload your code to the server and use `canvas run`
as the start command (e.g. in your Procfile, railway.toml, etc.)

```
canvas run examples/chat/src/contract.ts \
  --static examples/chat/dist \
  --network-explorer \
  --admin 0x34C3A5ea06a3A67229fb21a7043243B0eB3e853f \
  --topic chat-example.canvas.xyz \
  --offline
```

### With server-to-server sync ("decentralized apps")

For server-to-server libp2p sync, your steps will vary
depending on the exact hosting provider you're using, but you'll need
a hosting provider that supports opening at least two ports:

- A port for the main Canvas APIs
- A port for server-to-server libp2p incoming connections

By default, these are:

- Port 8080 should map to the port where `canvas run` binds its Express API.
- Port 4444 should map to the port where `canvas run` binds its libp2p service.

You will need to configure a libp2p private key as an environment
variable, and also configure environment variables so your node can
find other nodes on the network.

- ANNOUNCE should be your libp2p announce multiaddr that other peers
  use to find you, e.g. `/dns4/example-libp2p.canvas.xyz/tcp/443/wss`.
  Refer to the [multiaddr](https://github.com/libp2p/specs/blob/master/addressing/README.md)
  docs for the exact format.
- LIBP2P_PRIVATE_KEY should be configured as a libp2p private key. To
  generate one, we provide a script in the main Canvas repo:
  `node ./scripts/generateLibp2pPrivkey.js`

## Debugging

To enable debugging output in the browser, you can set a filter in localStorage:

```
localStorage.setItem("debug", "canvas:*")
```

To enable debugging for libp2p, you can set a similar filter:

```
localStorage.setItem("debug", "canvas:*, libp2p:*:trace")
```

When using the command line, set an environment variable instead:

```
DEBUG="canvas:*"
```

Finally, there are times when past data in IndexedDB may interfere
with an application's operation. We try to detect and recover from
this scenario, but if you encounter it, you can run this in the
console to clear any past data:

```ts
const dbs = await window.indexedDB.databases()
dbs.forEach((db) => {
  window.indexedDB.deleteDatabase(db.name)
})
```
