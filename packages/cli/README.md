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
  canvas init <path>    Initialize a new application
  canvas info <path>    Show the model schema and action names in a contract
  canvas run <path>     Run a Canvas application
  canvas export <path>  Export the action log as dag-json to stdout
  canvas import <app>   Import an action log from stdin

Options:
  --version  Show version number                                       [boolean]
  --help     Show help                                                 [boolean]
```

## Running an application

The main command is `canvas run <path>`. This will start a libp2p node, SQLite database, QuickJS VM for processing actions, and an HTTP API server. Use the `--help` flag to learn more.

### Joining the libp2p mesh

In the likely case that your machine is behind a NAT layer, you have to provide the CLI with both an internal port bind a WebSocket server using the `--listen` option, and a public external address using the `--announce` option. Both of these must be formatted as [multiaddrs](https://github.com/multiformats/multiaddr), the generic composable network address format used by libp2p.

For example, this tells the CLI to listen on port 4444 and advertise `wss://foobar.com:8000` as the public address:

```
$ canvas run myapp/ --listen /ip4/0.0.0.0/tcp/4444/ws --announce /dns4/foobar.com/tcp/443/wss
```

This assumes that you've configured your server to handle incoming secure websocket connections over TLS on port `443`, do TLS termination, and proxy the connection to your internal port `4444`.

A few things to note:

- You can pass as many `--announce` addresses as you want, but only one `--listen` address.
- You don't have to use TLS, but if you don't, browsers running embedded Canvas apps won't be able to talk to your peer.
- If you'd prefer to announce on a public static IP instead of a DNS name, announce on `/ip4/{publicIP}/tcp/{port}/wss`.
- If your DNS name only has `AAAA` records (???), use `/dns6` instead of `/dns4`.
- You can pass a `--listen` address without an `--announce` address to delegate to libp2p's autonat and identify services, which are works in progress. It's best to provide a public address if you have one.

Almost always, `--listen` will be of the form `/ip4/0.0.0.0/tcp/${port}/ws`, and `--announce` will be of the form `/dns4/${hostname}/tcp/{port}/wss`.

## HTTP API

Running a Canvas app with `canvas run` will serve an HTTP API at `http://127.0.0.1:8000/api/` by default. You can change the port with the `--port` option.

The basic routes are:

- `GET /api/models/:model` - query model records
- `GET /api/models/:model/:key` - get a model record by primary key
- `GET /api/clock` - get the next logical clock value from the log
- `GET /api/messages` - query ranges of log messages
- `GET /api/messages/:id` - get a message from the log
- `GET /api`

- `POST /` - Apply an action or session. The request body must be the action or session as JSON.
- `GET /` - Get application status and metadata. Returns an `ApplicationData` JSON object.
- `GET /some/route/path?param1=value1&param2=value2` - Evaluate a route. Returns a JSON array of SQL results. If the route has path components (declared by the spec with Express-style `/.../:name/...` names), the values of these params are bound to the query as strings. Additional params can be given in the query string as JSON values.

```ts
type ApplicationData = {
  peerId: string
  models: Record<string, Model>
  topics: Record<string, { actions: string[] | null }>
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
