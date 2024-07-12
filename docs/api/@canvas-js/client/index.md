[Documentation](../../packages.md) / @canvas-js/client

# @canvas-js/client

The `Client` class here manages one or more session signers to sign and post messages over the Canvas HTTP API.

The HTTP API in question is very simple:

- `GET /api/clock` returning `{ clock: number; parents: string[] }`
- `POST /api/insert` carrying `{}`
