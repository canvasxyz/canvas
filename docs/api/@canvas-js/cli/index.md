[Documentation](../../packages.md) / @canvas-js/cli

# @canvas-js/cli

Canvas provides a command line interface for running applications inside
Node.js.

This package lets you run individual application servers that join the
peer-to-peer network.

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
  canvas import <path>   Import an action log from stdin

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
$ canvas run ./myapp --listen /ip4/0.0.0.0/tcp/4444/ws --announce /dns4/foobar.com/tcp/443/wss
```

This assumes that you've configured your server to handle incoming secure websocket connections over TLS on port `443`, do TLS termination, and proxy the connection to your internal port `4444`.

A few things to note:

- You can pass as many `--announce` addresses as you want, but only one `--listen` address.
- You don't have to use TLS, but if you don't, browsers running embedded Canvas apps won't be able to talk to your peer.
- If you'd prefer to announce on a public static IP instead of a DNS name, announce on `/ip4/{publicIP}/tcp/{port}/wss`.
- If your DNS name has IPv6 `AAAA` records, you can use `/dns6` in addition to `/dns4`.
- You can pass a `--listen` address without an `--announce` address to delegate to libp2p's autonat and identify services, which are works in progress. It's best to provide a public address if you have one.

Almost always, `--listen` will be of the form `/ip4/0.0.0.0/tcp/${port}/ws`, and `--announce` will be of the form `/dns4/${hostname}/tcp/{port}/wss`.

## HTTP API

Running a Canvas app with `canvas run` will serve an HTTP API at `http://127.0.0.1:8000/api/` by default. You can change the port with the `--port` option.

The basic routes are:

- `GET  /api` - get application metadata
- `GET  /api/models/:model` - get model records
- `GET  /api/models/:model/:key` - get a model record by primary key
- `GET  /api/clock` - get the next logical clock value from the log
- `GET  /api/messages` - query ranges of log messages
- `GET  /api/messages/:id` - get a message from the log
- `POST /api/messages` - apply a signed message
- `GET  /api/connections` - current libp2p connections
- `GET  /api/peers` - current libp2p pubsub peers
- `POST /api/ping/:peerId` - ping a peer via libp2p

### Exposing optional endpoints

Some optional API endpoints are disabled by default, since they should't be exposed publicly.

- `--metrics` - serve Prometheus metrics at `/metrics`

The metrics reported to Prometheus include default NodeJS metric, internal libp2p metrics, and some additional metrics specific to Canvas `Core`.

#### `canvas_sync_time`

A histogram of MST sync times.

| label name | type     |
| ---------- | -------- |
| `topic`    | `string` |
| `duration` | `number` |
| `peer`     | `string` |

#### `canvas_messages`

A counter of messages applied

| label name | type     | description               |
| ---------- | -------- | ------------------------- |
| `topic`    | `string` |                           |
| `type`     | `string` | `"action"` or `"session"` |

### Serving static content alonside the API

`--static [directory]` can be used to serve a static directory alongside the application API. This is the easiest way to bundle a frontend that uses Canvas as a backend. If the `--static` flag is provided, the root path `/` serves the files in `[directory]`.
