# Additional Features

## Next.js Support

Next.js is a widely used framework for full-stack TypeScript apps,
that gives you a set of shared conventions for creating your frontend
and backend.

By default, Next.js apps use CLI commands like `next dev` to launch the app.

```
Backend (/api)   <-----  Next.js server (`next dev`)  <-----  Browser
                    |
Frontend (/app)  <---
```

You can use Canvas with Next.js, by creating a
[custom server.ts file](https://nextjs.org/docs/pages/guides/custom-server).
This will replace the `next start` and `next dev` commands with your own
server, but the rest of your app will remain unchanged.

```
Next.js API server (`next()`)  <-----  Express server  <-----  Browser
                                  |
Canvas class (`new Canvas()`)  <---
```

First, follow [these instructions](https://nextjs.org/docs/pages/guides/custom-server) to set up a custom server. This will give you a `handle` function that
you need to call inside an Node.js server.

From there, initialize a Canvas class, and make it available inside the custom server using the `createAPI` method:

```ts
import { Canvas } from "@canvas-js/core"
import { createAPI } from "@canvas-js/core/api"

// ...

nextApp.prepare().then(async () => {
	const canvasApp = await Canvas.initialize({
		path: process.env.DATABASE_URL,
		contract: MyApp,
	})

	const expressApp = express()
	expressApp.use("/api", createAPI(canvasApp))

  // Next.js handler goes here
	expressApp.all("*", (req, res) => {
		return handle(req, res)
	})

  // expressApp.listen(...)
})
```

You'll want to use server.ts as the entry point to your app - and
start it using a command like `tsx server.ts` or `node server.js`.

Refer to the chat-next example to
[see how this works](https://github.com/canvasxyz/canvas/blob/main/examples/chat-next/server.ts).

## Synchronous Loader

In Next.js, React Native, or bundlers targeting earlier versions of
JS, you might not be able to use the top-level await feature to
initialize a Canvas contract.

But you still might want to create a Canvas instance as an export.
To work around this, we provide an experimental `@canvas-js/core/sync` module:

```ts
import { Canvas } from "@canvas-js/core/sync";

export const app = new Canvas({
  topic: "pogiciv.vercel.app",
  contract: MyApp,
})
```

This constructor wraps and proxies the regular `Canvas` object, and
defers calls to the `actions` and `db` APIs.

Other calls on the Canvas object, like .listen() or .startLibp2p(), will not work until
`await Canvas.initialize()` is completed.

## Sync Status API

The `app.syncStatus` property exposes the sync status of a browser-to-server application.

Browser-to-server sync runs over multiple sessions, in case a sync is interrupted or
internet connectivity is momentarily lost. Each sync session either runs to completion,
or times out after a predetermined period, triggering another sync session.

```ts
export type ClientSyncStatus =
  "offline" | "starting" | "inProgress" | "complete" | "error"
```

- The sync status is initialized as "offline".
- When an initial connection is established, the sync status is set to "starting".
- When part of a longer sync is completed, the sync status is set to "inProgress".
- When a sync session runs to completion, the sync status is set to "complete".

You can also observe changes to the sync status by listening to the app's message log:

```ts
app.messageLog.addEventListener("connect", updateSyncStatus)
app.messageLog.addEventListener("disconnect", updateSyncStatus)
app.messageLog.addEventListener("sync:status", updateSyncStatus)
```
