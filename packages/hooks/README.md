# @canvas-js/hooks

React hooks for Canvas applications.

## `useCanvas`

The `useCanvas` hook initializes a Canvas application inside a React component,
returning the application as `app` and a NetworkClient object as `ws`.

It accepts a WebSocket URL (or null) as the first argument, and the
same configuration object as `Canvas.initialize()` does for the second argument.

If you provide a WebSocket URL, it will try to connect to that WebSocket and
use browser-to-server sync to stay updated with it.

```ts
import { SIWESigner } from "@canvas-js/signer-ethereum"
import { useCanvas } from "@canvas-js/hooks"
import { useMemo } from "react"

export function MyApp() {
  const wallet = useMemo(() => {
    return ethers.Wallet.createRandom()
  }, [])

  const { app, ws, error } = useCanvas("wss://forum-example.canvas.xyz", {
    topic: "forum-example.canvas.xyz",
    contract: {
      // ...
    },
    signers: [new SIWESigner({ signer: wallet })],
  })
}
```

Note that `app` might be null when the hook initializes.

Once a connection is established, `ws` will be a `NetworkClient`
object that returns the state of the connection.

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

## `AuthProvider`

The `AuthProvider` provider is used with login components, and used to
keep track of a currently logged in session address to use for the
app. Configure it like any other provider:

```ts
import { AuthProvider } from "@canvas-js/hooks"
import { App } from "./App.js"

const root = ReactDOM.createRoot(document.getElementById("root")!)

root.render(
	<AuthProvider>
		// other providers here
		<App />
	</AuthProvider>,
)
```

With AuthProvider, you can use signer-specific auth components:

- In `@canvas-js/hooks/components`, the `ConnectSIWE` component provides a login/logout button
that uses the browser's current Ethereum wallet.
- In `@canvas-js/hooks/components`, the `ConnectSIWF` component provides a login/logout button
that supports in-browser or in-frame login via Sign in With Farcaster.
