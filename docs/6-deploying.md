# Running & Deploying Peers

You can run an application in the browser without connecting
to a server, but when you're ready to go live, you'll want to deploy
to a server anyone can connect to.

## Preparing for deployment

To get started, we recommend creating a separate `contract.ts` file
that's imported from your frontend:

```ts
import { Contract } from "@canvas-js/core/contract"
import type { ModelSchema } from "@canvas-js/core"

class Chat extends Contract<typeof Chat.models> {
  static topic = "chat.example.xyz"

  static models = {
    messages: {
      id: "primary",
      content: "string",
      address: "string",
    }
  } satisfies ModelSchema

  async createMessage(content: string) {
    this.db.create("messages", {
      content,
      address: this.address
    })
  }
}

export default Chat
```

Then, import the contract class:

```ts
import { useCanvas, useLiveQuery } from "@canvas-js/hooks"
import Chat from "./contract.js"

const wsURL = process.env.wsURL

export const App = () => {
  const { app, ws } = useCanvas(wsURL, {
    contract: Chat,
    topic: "example.xyz",
  })
}
```

## Running a local development node

Using the contract.ts file, now you can run a development node for the
application above, with one command:

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

Some relevant options:

* If you provide `--network-explorer`, the CLI will serve a
management interface at localhost:8000/explorer, which will show you
data and action history.
* If you run the application with `/data/canvas-example --init contract.ts`
instead, the local node will copy of the contract to the data directory
you've provided instead. This will ensure that application data persists
when the CLI is shut down.
* If you provide `--admin <ethAddr>`, you will be able to upgrade the
running contract by signing a message with your address. This will cause
the instance to terminate and start over again.

By default, the local node is backed by SQLite. If you would prefer to
use Postgres as a backing database, create a local Postgres DB and
provide its URL as an environment variable:

```sh
DATABASE_URL="postgres://localhost:5432/..." canvas run \
  --topic example.xyz \
  --init contract.ts /data/canvas-example
```

Then, the data directory will only be used to store metadata.

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