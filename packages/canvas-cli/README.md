# @canvas-js/cli

Command line interface for using Canvas.

## Core API

- `GET /` - get metadata about the application. Returns `{ uri: string; cid: string; actions: string[]; routes: string[] }`.
- `POST /actions` - apply an action.
- `POST /sessions` - apply a session.
- `GET /some/route/path` - Get the value of a route, or open an server-sent event connection. Either returns a `text/event-stream` or a `application/json` array, depending on the requested `Accpet` header.

## Daemon API

- `PUT /app/some-app-name` - body must be a `Content-Type: text/javascript` spec. Creates a new app with name `some-app-name` and returns the hash in an `ETag` response header. Does not start the app. Succeeds with status `OK`, or fails with status `CONFLICT` if an app with that name already exists.
- `DELETE /app/some-app-name` - permanently deletes the app with name `some-app-name`, and all of its associated data. Succeeds with status `OK`, or fails with status `NOT_FOUND` if no app with that name already exists.
- `POST /app/some-app-name/start` - start the app with name `some-app-name`. Succeeds with status `OK`, fails with status `CONFLICT` if the app is already running, or fails with status `NOT_FOUND` if no app with that name already exists.
- `POST /app/some-app-name/stop` - stop the app with name `some-app-name`. Succeeds with status `OK`, or fails with status `CONFLICT` if the app is not already running.
- `GET /app/some-app-name` - same as getting application metadata in the Core API. Returns `{ uri: string; cid: string; actions: string[]; routes: string[] }`.
- `POST /app/some-app-name/actions` - same as action application in the Core API.
- `POST /app/some-app-name/sessions` - same as session application in the Core API.
- `GET /app/some-app-name/some/route/path` - same as fetching routes in the Core API. Either returns a `text/event-stream` or a `application/json` array, depending on the requested `Accpet` header.

(c) 2022 Canvas Technology Corporation
