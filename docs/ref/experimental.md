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
