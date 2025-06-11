# Experimental Features

Features listed on this page may not work for all users, or have
limited support or be deprecated in the future.

## Synchronous Loading

Some environments may prevent you from initializing the `Canvas` object using `await`,
because of the lack of support for top-level await.

To support this, we provide a `@canvas-js/core/sync` export:

```ts
import { Canvas } from "@canvas-js/core/sync";

export const app = new Canvas>({
  topic: "pogiciv.vercel.app",
  contract: MyApp,
})
```

Currently, the returned object does not match the main Canvas class' types exactly.
So, you can cast it to the regular Canvas type:

```ts
import { ActionAPI, ContractAction, Canvas as Core } from "@canvas-js/core";
import { Canvas } from "@canvas-js/core/sync";
import { MyApp } from "./MyApp.js";

export const app = new Canvas<typeof models, InstanceType<typeof MyApp>>({
  topic: "pogiciv.vercel.app",
  contract: Pogiciv,
}) as unknown as Core<typeof models, InstanceType<typeof MyApp>>;
```

Some considerations:

- The loader does not help you wait until the contract is fully
  synced up to any of its peers. Use the sync state API for that instead.
- The loader uses a proxy to defer action calls to the object, which specifically proxies
  the  `actions` and `db` APIs. **Other calls on the Canvas object may not work.**
- If you execute any actions before the app has initialized, they will fail with an error.

## Sync Status API

The `app.syncStatus` property exposes the sync status of a browser-to-server application.

Browser-to-server sync runs over multiple sessions, in case a sync is interrupted or
internet connectivity is momentarily lost. Each sync session either runs to completion,
or times out after a predetermined period, triggering another sync session.

```ts
export type ClientSyncStatus = "offline" | "starting" | "inProgress" | "complete" | "error"
```

- When an initial connection is established, the sync status is set to "starting".
- When part of a longer sync is completed, the sync status is set to "inProgress".
- When a sync session runs to completion, the sync status is set to "complete".

Finally, you can also observe changes to the sync status by listening to the app's message log:

```ts
app.messageLog.addEventListener("connect", updateSyncStatus)
app.messageLog.addEventListener("disconnect", updateSyncStatus)
app.messageLog.addEventListener("sync:status", updateSyncStatus)
```
