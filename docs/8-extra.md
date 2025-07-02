# Additional Features

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
