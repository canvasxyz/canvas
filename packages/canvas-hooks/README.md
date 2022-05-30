# @canvas-js/hooks

React hooks for using Canvas in your frontend application.

To use the Canvas hooks, you must first wrap your application in a parent `Canvas` element, which initializes state and sets an internal React context for the hooks to use. The only thing you have to pass the `Canvas` element is a `host: string` URL of a canvas app's HTTP API server.

```tsx
<Canvas host="http://localhost:8000">
	<MyApp />
</Canvas>
```

Then, in any component inside your app, you can use the two canvas hooks: `useCanvas` and `useRoute`.

`useCanvas` returns an object with configuration data about the connected canvas app and the currently-authenticated user. Most importantly, it has an async `dispatch` method that you can use to sign and send actions.

`useRoute` takes a string route and an object of params, and works like the `useSWR` hook, returning an error or an array of results. By default, if polls the server every three seconds, which you can change by setting the `refreshInterval: number` property on the parent `Canvas` element.

```ts
import type { ethers } from "ethers"
import type { ActionArgument, ModelValue } from "@canvas-js/core"

declare function useCanvas(): {
	multihash: string | null
	currentAddress: string | null
	dispatch: (call: string, args: ActionArgument[]) => Promise<void>
	connect: () => void
	provider: ethers.providers.Provider | null
}

declare function useRoute<T extends Record<string, ModelValue> = Record<string, ModelValue>>(
	route: string,
	params?: Record<string, string>
): [null | Error, null | T[]]
```

See the `packages/example-webpack` directory for an example application using these hooks.

(c) 2022 Canvas Technology Corporation
