# @canvas-js/hooks

React hooks for using Canvas in your frontend application.

To use the Canvas hooks, you must first wrap your application in a parent `Canvas` element, which initializes state and sets an internal React context for the hooks to use. The only thing you have to pass the `Canvas` element is a `host: string` URL of a canvas app's HTTP API server.

```tsx
<Canvas host="http://localhost:8000">
	<MyApp />
</Canvas>
```

Then, in any component inside your app, you can use the two canvas hooks: `useCanvas` and `useRoute`.

`useCanvas` returns an object with configuration data about the connected canvas app and the currently-authenticated user. Most importantly, it has an async `connect` method to request authentication from MetaMask and an async `dispatch` method that you can use to sign and send actions.

`useRoute` takes a string route and an object of params, and works like the `useSWR` hook, returning an error or an array of results. Internally, it uses the [EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource).

```ts
import type { ethers } from "ethers"
import type { ActionArgument, ModelValue } from "@canvas-js/core"

/**
 * Here are the rules for the useCanvas hook:
 * - Initially, `loading` is true, and `multihash` and `address` are null.
 * - Once the hook connects to both window.ethereum and the remote backend,
 *   `loading` will switch to false, with non-null `multihash`. However, `address`
 *   might still be null, in which case you MUST call `connect` to request accounts.
 * - Calling `connect` with `window.ethereum === undefined` will throw an error.
 * - Calling `connect` or `dispatch` while `loading` is true will throw an error.
 * - Once `loading` is true, you can call `dispatch` with a `call` string and `args` array.
 *   If no existing session is found in localStorage, or if the existing session has
 *   expired, then this will prompt the user to sign a new session key.
 */
declare function useCanvas(): {
	multihash: string | null
	error: Error | null
	loading: boolean
	address: string | null
	dispatch: (call: string, args: ActionArgument[]) => Promise<void>
	connect: () => Promise<void>
}

declare function useRoute<T extends Record<string, ModelValue> = Record<string, ModelValue>>(
	route: string,
	params?: Record<string, string>
): { error: Error | null; data: T[] | null }
```

See the `packages/example-webpack` directory for an example application using these hooks.

(c) 2022 Canvas Technology Corporation
