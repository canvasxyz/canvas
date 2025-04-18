# @canvas-js/hooks

Hooks for using Canvas applications in React.

## `useCanvas`

The `useCanvas` hook initializes a Canvas application inside a React component,
returning the application as `app` and a NetworkClient object as `ws`.

It accepts a WebSocket URL (or null) as the first argument, and the
same configuration object as `Canvas.initialize()` does for the second argument.

If you provide a WebSocket URL, it will try to connect to that WebSocket and
use browser-to-server sync to stay updated with it.

```ts
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { useCanvas } from "@canvas-js/hooks"
import { useMemo } from "react"

export function MyApp() {
  const wallet = useMemo(() => {
    return ethers.Wallet.createRandom()
  }, [])

  const { app, error } = useCanvas("wss://forum-example.canvas.xyz", {
    topic: "forum-example.canvas.xyz",
    contract: {
      // ...
    },
    signers: [new SIWESigner({ signer: wallet })],
  })
}
```

Note that `app` might be null when the hook initializes.

## `useLiveQuery`

The `useLiveQuery` hook maintains a live-updated frontend query on top of a Canvas application.

You can see a more [complete example here](/readme-core.html#subscribing-to-live-queries).

Example usage:

```ts
import { useLiveQuery } from "@canvas-js/hooks"

export function MyComponent({ app }: { app?: Canvas }) {
  const threads = useLiveQuery<Thread>(app, "threads", {
    offset: page * 10,
    limit: 10,
    orderBy: { timestamp: "desc" },
    where: category === "all" ? undefined : { category },
  })
}
```
