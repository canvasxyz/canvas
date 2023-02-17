# Canvas Command Line

Canvas provides a command line interface for starting a node for any
Canvas contract. This is the primary and recommended way to run
applications and join the peer-to-peer network.

To install the CLI, run:

```
npm install -g @canvas-js/cli
```

The CLI includes a built-in IPFS node, SQLite, the QuickJS VM for
processing actions, and an API server. Use the `--help` flag to learn more.

```
canvas <command>

Commands:
  canvas init <filename>  Create a sample spec for demonstration purposes
  canvas info <spec>      Show the models, views, and actions for a spec
  canvas run <spec>       Run an app, by path or IPFS hash
  canvas export <spec>    Export actions and sessions as JSON to stdout
  canvas import <spec>    Import actions and sessions from stdin
  canvas list             List all specs in the data directory
  canvas install <spec>   Install an app in the canvas home directory
  canvas daemon           Start the canvas daemon
  canvas start <spec>     Start an app on the daemon
  canvas stop <spec>      Stop an app on the daemon

Options:
  --version  Show version number                                       [boolean]
  --help     Show help                                                 [boolean]
```

## `canvas run`

To run a Canvas node, here are a few important options:

- `--chain-rpc` is used to provide the node with RPC URLs where it can get blockchain data. You should provide an RPC node for each unique chain ID that you want your contracts to support. The set of supported chains is automatically relayed to the frontend, so any React hooks can prompt the user to switch to the right chain.
- Running an application by its filename will run it in development mode. To run an application in production mode, provide `--install` or run it by providing its IPFS hash.
- `--static` can be used to serve static files alongside an application. This can be used to serve a Canvas frontend at the base URL `/` which talks to APIs served under the `/api` path.

```
canvas run <app>

Run an app, by path or IPFS hash

Positionals:
  app  Path to app file, or IPFS hash of app                 [string] [required]

Options:
  --version    Show version number                                     [boolean]
  --help       Show help                                               [boolean]
  --port       Port to bind the Core API                [number] [default: 8000]
  --offline    Disable libp2p                         [boolean] [default: false]
  --install    Install a local app and run it in production mode
                                                      [boolean] [default: false]
  --listen     libp2p WebSocket transport port          [number] [default: 4044]
  --announce   Accept incoming libp2p connections on a public multiaddr [string]
  --reset      Reset the message log and model databases
                                                      [boolean] [default: false]
  --replay     Reconstruct the model database by replying the message log
                                                      [boolean] [default: false]
  --unchecked  Run the node in unchecked mode, without verifying block hashes
                                                                       [boolean]
  --metrics    Expose Prometheus endpoint at /metrics [boolean] [default: false]
  --verbose    Enable verbose logging                 [boolean] [default: false]
  --chain-rpc  Provide an RPC endpoint for reading on-chain data         [array]
  --static     Serve a static directory from /, and API routes from /api[string]
```

## Single-Core HTTP API

```
$ canvas run <QmFoo...>
```

Binds to `http://127.0.0.1:8000` by default.

- `GET /` - get metadata about the application. Returns `{ uri: string; cid: string; actions: string[]; routes: string[] }`.
- `POST /actions` - apply an action.
- `POST /sessions` - apply a session.
- `GET /some/route/path` - Get the value of a route, or open an server-sent event connection. Either returns a `text/event-stream` or a `application/json` array, depending on the requested `Accept` header.

## Daemon HTTP API

```
$ canvas daemon
```

Binds to `~/.canvas/daemon.sock`. Pass a `--port` argument to additionally bind to a port on `127.0.0.1`.

- `GET /app` - list the installed applications. Returns an object `Record<string, string>` mapping app names to CIDs. For apps installed and run through normal CLI usage, these (app names and CIDs) will be the same.
- `PUT /app/some-app-name` - body must be a `Content-Type: text/javascript` spec. Creates a new app with name `some-app-name` and returns the hash in an `ETag` response header. Does not start the app. Succeeds with status `OK`, or fails with status `CONFLICT` if an app with that name already exists.
- `DELETE /app/some-app-name` - permanently deletes the app with name `some-app-name`, and all of its associated data. Succeeds with status `OK`, or fails with status `NOT_FOUND` if no app with that name already exists.
- `POST /app/some-app-name/start` - start the app with name `some-app-name`. Succeeds with status `OK`, fails with status `CONFLICT` if the app is already running, or fails with status `NOT_FOUND` if no app with that name already exists.
- `POST /app/some-app-name/stop` - stop the app with name `some-app-name`. Succeeds with status `OK`, or fails with status `CONFLICT` if the app is not already running.
- `GET /app/some-app-name` - same as getting application metadata in the Core API. Returns `{ uri: string; cid: string; actions: string[]; routes: string[] }`.
- `POST /app/some-app-name/actions` - same as action application in the Core API.
- `POST /app/some-app-name/sessions` - same as session application in the Core API.
- `GET /app/some-app-name/some/route/path` - same as fetching routes in the Core API. Either returns a `text/event-stream` or a `application/json` array, depending on the requested `Accpet` header.
