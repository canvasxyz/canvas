# Canvas React Hooks

Canvas provides React hooks for using Canvas in your frontend
application.

The React hooks are currently developed for Ethereum-compatible
chains, with [Ethers v5](https://docs.ethers.org/v5/) and
[wagmi](https://wagmi.sh/).


## Table of Contents

- [`<Canvas />`](#canvas): configures the connection to Canvas
- [`useCanvas()`](#usecanvas): returns the current app and user
- [`useRoute(route, options)`](#useroute): fetches or subscribes to a route
- [`useSession(chainImplementation, signer)`](#usesession): wraps an Ethereum signer, and exposes login(), logout(), and client.action() methods for taking actions

## `<Canvas />`

To use the Canvas hooks, you must first wrap your application in a parent `Canvas` element, which initializes state and sets an internal React context for the hooks to use. The only thing you have to pass the `Canvas` element is a `host: string` URL of a canvas app's HTTP API server.

```tsx
<Canvas host="http://localhost:8000">
	<MyApp />
</Canvas>
```

## `useCanvas`

You can access metadata about the host, and the application the host is serving, using the `useCanvas` hook anywhere inside the parent `Canvas` element.

```tsx
import { useCanvas } from "@canvas-js/hooks"

function MyApp({}) {
	const { host, isLoading, data, error } = useCanvas()

	return <div>{/* ...*/}</div>
}
```

`isLoading` is initially `true` while the hook makes an initial HTTP request for application metadata, and then sets to `false` when either `data` or `error` is non-null.

```ts
interface ApplicationData {
	cid: string
	uri: string
	appName: string
	peerId: string | null
	actions: string[]
	routes: string[]
	merkleRoots: Record<string, string>
	chainImplementations: Record<string, string[]>
	peers: {
		gossip: Record<string, { lastSeen: number }>
		sync: Record<string, { lastSeen: number }>
	} | null
}

declare function useCanvas(): {
	host: string | null
	data: ApplicationData | null
	error: Error | null
	isLoading: boolean
}
```

## `useRoute`

You can use `useRoute` to fetch/subscribe to data from your application's routes.

For example, to subscribe to the /posts route:

```tsx
import { useRoute } from "@canvas-js/hooks"

function MyApp({}) {
	const { data, error, isLoading } = useRoute<{ content: string }>("/posts/:user", { user: "joel" })
	// data: { content: string }[] | null
	// error: Error | null
	// isLoading: boolean

	return <div>{/* ...*/}</div>
}
```

The hook will re-render every time the resulting `data` changes (compared deep equality).

Use this pattern when you want the host to push data to the client. **Don't** use this pattern if the parameter values (`{ user: "joel" }` in the example) change often. For subscriptions, routes are bound to concrete parameter values, so changing the parameters forces the hook to unsubscribe and re-subscribe.

You can also provide a callback to the hook, which will be triggered whenever new data is returned from the hook. **If you do this, make sure to memoize your callback (i.e. wrap it in useCallback())!**

**Fetching routes without a subscription**

The `useRoute` hook can also fetch routes without subscribing to them. Pass a `{ subscribe: false }` options object as the third argument and the hook will use regulular HTTP GET requests, re-fetching the route data every time any of the parameter values passed to the hook change (and only then).

```tsx
import { useRoute } from "@canvas-js/hooks"

function MyApp({}) {
	const { data, error, isLoading } = useRoute<{ content: string }>(
		"/posts/:user",
		{ user: "joel" },
		{ subscribe: false }
	)
	// data: { content: string }[] | null
	// error: Error | null
	// isLoading: boolean

	return <div>{/* ...*/}</div>
}
```

```ts
import { ModelValue } from "@canvas-js/interfaces"

function useRoute<T extends Record<string, ModelValue> = Record<string, ModelValue>>(
	route: string,
	params: Record<string, ModelValue>,
	options: { subscribe?: boolean } = { subscribe: true }
): { error: Error | null; isLoading: boolean; data: T[] | null }
```

## `useSession`

`useSession` accepts an Ethereum signer, and returns login() and
logout() methods, and a client for dispatching actions.

For example:

```tsx
import { useProvider, useSigner, useNetwork } from "wagmi"
import { EthereumChainImplementation } from "@canvas-js/ethereum"

function MyApp({}) {
	const provider = useProvider<ethers.providers.JsonRpcProvider>()
	const { error, data: signer } = useSigner<ethers.providers.JsonRpcSigner>()
	const { chain } = useNetwork()

	const chainImplementation = useMemo(
		() => new EthereumChainImplementation(chain?.id?.toString(), provider),
		[provider, chain?.id]
	)

	const { login, logout, client } = useSession(chainImplementation, signer)

	const handleSubmit = useCallback(
		async (content: string) => {
			if (client !== null) {
				try {
					const { hash } = await client.createPost({ content })
					console.log("successfully posted action", hash)
				} catch (err) {
					console.error(err)
				}
			}
		},
		[client]
	)

	return <div>{/* ...*/}</div>
}
```

The `useSession` hook is in one of the following three states:

- `isLoading === true`: waiting for application data from host, & checking localStorage for sessionObject
- `isLoading === false && sessionAddress === null`: logged out, need to call login()
- `isLoading === false && sessionAddress !== null`: we have a session and `client` will be non-null

`client`, `sessionAddress`, and `sessionExpiration` are either all null or all non-null.

```ts
import { ChainImplementation, Argument } from "@canvas-js/hooks"

export type Client = Record<string, (callArgs: Record<string, ActionArgument>) => Promise<{ hash: string }>>

export function useSession<Signer, DelegatedSigner>(
	chainImplementation: ChainImplementation<Signer, DelegatedSigner>,
	signer: Signer | null | undefined,
	options: { sessionDuration?: number; unchecked?: boolean } = {}
): {
	isLoading: boolean
	isPending: boolean
	sessionAddress: string | null
	sessionExpiration: number | null
	login: () => void
	logout: () => void
	client: Client | null
}
```
