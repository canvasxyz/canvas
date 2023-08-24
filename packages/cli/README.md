# Canvas CLI

Canvas provides a command line interface for running Canvas applications. This is the primary way to run apps and join the peer-to-peer network.

## Installation

To install the CLI, run:

```
npm install -g @canvas-js/cli
```

## Usage

```
canvas <command>

Commands:
  canvas init <filename>  Create an example contract
  canvas info <spec>      Show the models, views, and actions for a spec
  canvas run <spec>       Run an app, by path or IPFS hash
  canvas export <spec>    Export actions and sessions as JSON to stdout
  canvas import <spec>    Import actions and sessions from stdin
  canvas list             List all specs in the data directory
  canvas install <spec>   Install an app in the canvas home directory

Options:
  --version  Show version number                                       [boolean]
  --help     Show help                                                 [boolean]
```

The Canvas CLI stores contracts and their data in the `$CANVAS_HOME` directory, which defaults to `~/.canvas` if not set.

## Running an application

The main command is `canvas run <app>`. This will start a libp2p node, SQLite database, QuickJS VM for processing actions, and an HTTP API server. Use the `--help` flag to learn more.

### Installing contracts

The `app` positional argument can either be a filename or the bare IPFS CIDv0 of a contract. By default, passing a filename will start the app in development mode, which runs entirely offline and in-memory. To persist data in the `$CANVAS_HOME` directory and join the libp2p mesh, you can install the app with `canvas install <filename>` and then run it by its CID.

`canvas run <filename> --install` is a shortcut that does both of these in one step, initializing a new app directory inside `$CANVAS_HOME` if necessary.

### Providing chain RPCs and multi-chain support

Canvas applications declare which chains they support using the `export const chains: string[]` contract export, which is an array of [CAIP-2 chain identifiers](https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-2.md). For now, the CLI **only supports Ethereum chains** whose CAIP-2 identifiers are of the form `eip155:${chainId}`. `eip155:1` is mainnet, `eip155:100` is Gnosis, and so on.

When you run an app from the CLI, you have to provide an RPC URL for each of these chains declared by the contract so that the runtime can validate the blockhashes in messages and call the view functions of any external on-chain contracts. This is done with the `--chain=${url}` option.

```
$ canvas run example.canvas.js --install --chain eip155:1=https://mainnet.infura.io/v3/...
```

If your app doesn't use on-chain contracts and you don't want to require blockhashes in messages, you can use the `--unchecked` flag to disable these checks and omit the RPC URL. However, you still have to pass the CAIP-2 identifiers for all of the chains in the contract.

```
$ canvas run example.canvas.js --install --chain eip155:1 --unchecked
```

In either case, you can pass multiple `--chain` options, and will have to if the contract declares more than one chain.

### Joining the libp2p mesh

By default, `canvas run` assumes that you are behind a NAT layer without a public IP address. It will still automatically join the libp2p mesh using the **public Canvas relay servers** that the developers run. Relayed connections are secure, but aren't real p2p and shouldn't be used in production.

To join the libp2p mesh directly, you have to provide the CLI with an internal port bind a WebSocket server using the `--listen` option, and a public external address using the `--announce` option. Both of these must be formatted as [multiaddrs](https://github.com/multiformats/multiaddr), the generic composable network address format used by libp2p.

For example, this tells the CLI to listen on port 4444 and advertise `wss://foobar.com:8000` as the public address:

```
$ canvas run example.canvas.js ... --listen /ip4/0.0.0.0/tcp/4444/ws --announce /dns4/foobar.com/tcp/443/wss
```

This assumes that you've configured your server to handle incoming secure websocket connections over TLS on port `443`, do TLS termination, and proxy the connection to your internal port `4444`.

A few things to note:

- You can pass as many `--announce` addresses as you want, but only one `--listen` address.
- You don't have to use TLS, but if you don't, browsers running embedded Canvas apps won't be able to talk to your peer.
- If you'd prefer to announce on a public static IP instead of a DNS name, announce on `/ip4/{publicIP}/tcp/{port}/wss`.
- If your DNS name only has `AAAA` records (???), use `/dns6` instead of `/dns4`.
- You can pass a `--listen` address without an `--announce` address to delegate to libp2p's autonat and identify services, which are works in progress. It's best to provide a public address if you have one.

Almost always, `--listen` will be of the form `/ip4/0.0.0.0/tcp/${port}/ws`, and `--announce` will be of the form `/dns4/${hostname}/tcp/{port}/wss`.

### Reference

```
canvas run <app>

Run an app, by path or IPFS hash

Positionals:
  app  Path to app file, or IPFS hash of app                 [string] [required]

Options:
  --version       Show version number                                  [boolean]
  --help          Show help                                            [boolean]
  --port          Port to bind the Core API             [number] [default: 8000]
  --offline       Disable libp2p                      [boolean] [default: false]
  --disable-ping  Disable peer health check pings     [boolean] [default: false]
  --install       Install a local app and run it in production mode
                                                      [boolean] [default: false]
  --listen        Internal libp2p /ws multiaddr, e.g. /ip4/0.0.0.0/tcp/4444/ws
                                                                         [array]
  --announce      Public libp2p /ws multiaddr, e.g. /dns4/myapp.com/tcp/4444/ws
                                                                         [array]
  --reset         Reset the message log and model databases
                                                      [boolean] [default: false]
  --replay        Reconstruct the model database by replying the message log
                                                      [boolean] [default: false]
  --unchecked     Run the node in unchecked mode, without verifying block hashes
                                                                       [boolean]
  --metrics       Expose Prometheus endpoint at /metrics
                                                      [boolean] [default: false]
  --p2p           Expose internal libp2p debugging endpoints
                                                      [boolean] [default: false]
  --verbose       Enable verbose logging              [boolean] [default: false]
  --chain         Declare chain implementations and provide RPC endpoints for re
                  ading on-chain data (format: {chain} or {chain}={URL}) [array]
  --static        Serve a static directory from /, and API routes from /api
                                                                        [string]
```

## HTTP API

Running a Canvas app with `canvas run` will serve an HTTP API on `http://127.0.0.1:8000` by default. You can change the port with the `--port` option.

The basic routes are:

- `POST /` - Apply an action or session. The request body must be the action or session as JSON.
- `GET /` - Get application status and metadata. Returns an `ApplicationData` JSON object.
- `GET /some/route/path?param1=value1&param2=value2` - Evaluate a route. Returns a JSON array of SQL results. If the route has path components (declared by the spec with Express-style `/.../:name/...` names), the values of these params are bound to the query as strings. Additional params can be given in the query string as JSON values.

```ts
type ApplicationData = {
	cid: string
	uri: string
	peerId: string | null
	actions: string[]
	routes: string[]
	chains: string[]
	peers: { id: string; protocols?: string[]; addresses?: string[] }[]
	merkleRoots: Record<string, string>
}
```

### Exposing optional endpoints

Some optional API endpoints are disabled by default, since they should't be exposed publicly.

- `--metrics` - serve Prometheus metrics at `/metrics`.
- `--p2p` - expose internal libp2p endpoints under the `/p2p/` prefix.
  - `GET /p2p/connections` - returns a `{ peerId: string, address: string }[]` JSON array of the current peer connections.
  - `POST /p2p/ping/:peerId` - attempt to ping a peer by PeerId, and respond with the latency in milliseconds if successful.

The metrics reported to Prometheus include default NodeJS metric, internal libp2p metrics, and some additional metrics specific to Canvas `Core`.

#### `canvas_sync_time`

A histogram of MST sync times.

| label name | type     | description                       |
| ---------- | -------- | --------------------------------- |
| `uri`      | `string` | the source `ipfs://` URI          |
| `status`   | `string` | either `"success"` or `"failure"` |

#### `canvas_messages`

A counter of messages applied

| label name | type     | description                      |
| ---------- | -------- | -------------------------------- |
| `type`     | `string` | either `"action"` or `"session"` |
| `uri`      | `string` | the source `ipfs://` URI         |

#### `canvas_gossipsub_subscribers`

A gauge counting GossipSub topic subscribers.

| label name | type     | description              |
| ---------- | -------- | ------------------------ |
| `uri`      | `string` | the source `ipfs://` URI |

#### `canvas_sync_peers`

A gauge counting the observed active DHT application peers.

| label name | type     | description              |
| ---------- | -------- | ------------------------ |
| `uri`      | `string` | the source `ipfs://` URI |

### Subscribing to events over a WebSocket connection

The HTTP API also accepts WebSocket connections at the root path `/`. The WebSocket server will respond to messages with `message.data === "ping"` with `socket.send("pong")`. Otherwise, it is used to push application _events_ to clients in real-time. Events are all of the form `{ type: string, detail: { ... } }`.

- `{ type: "update", detail: { uri: string; root: string | null } }` - emitted after apply a new batch of actions and committing the effects to the model database.
- `{ type: "sync", detail: { uri: string; peer: string; time: number; status: "success" | "failure" } }` - emitted after intiating MST sync with another peer.
- `{ type: "connect", detail: { peer: string } }` - emitted after opening a new libp2p connection to another peer. These are low-level transport-layer connections, not application-level logical streams. This means the peers aren't necessarily running the same application, since all Canvas peers connect on the same mesh and share a DHT.
- `{ type: "disconnect", detail: { peer: string } }` - emitted after closing a libp2p connection.

### Serving static content alonside the API

`--static [directory]` can be used to serve a static directory alongside the application API. This is the easiest way to bundle a frontend that uses Canvas as a backend. If the `--static` flag is provided, all of the HTTP API routes move under the `/api/` prefix, and the root path `/` serves the files in `[directory]`.
