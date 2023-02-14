# @canvas-js/hooks

This package includes React hooks for using Canvas in your frontend
application.


## Table of Contents

- [`<Canvas />`](#canvas)
- [`useCanvas`](#usecanvas)
- [`useRoute`](#useroute)
- [`useSession`](#usesession)


## `<Canvas />`

To use the Canvas hooks, you must first wrap your application in a parent `Canvas` element, which initializes state and sets an internal React context for the hooks to use. The only thing you have to pass the `Canvas` element is a `host: string` URL of a canvas app's HTTP API server.

```tsx
<Canvas host="http://localhost:8000">
	<MyApp />
</Canvas>
```

Then, in any component inside your app, you can use the three hooks:
`useCanvas`, `useRoute`, and `useSession`.

- `useCanvas` returns an object with configuration data about the
  connected Canvas app and the currently-authenticated user.
- `useRoute` takes a string route and an object of params, and works
  like the `useSWR` hook, returning an error or an array of
  results. Internally, it uses the [EventSource
  API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource).
- `useSession` accepts a signer from wagmi (for Ethereum), or an
  injected signer from other networks, and returns a client for
  dispatching actions.


## `useCanvas`

You can then access metadata about the host and the application the host is serving using the `useCanvas` hook anywhere inside the parent `Canvas` element.

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
	component: string | null
	actions: string[]
	routes: string[]
	peerId: string | null
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

`useRoute` is the primary way to fetch data from your application.

There are two ways to use the `useRoute` hook to fetch data. The `Canvas` element internally establishes a websocket connection to the host, and, by default, the `useRoute` hook will use that websocket connection to subscribe to a given route with given params.

For example, subscribing to the posts for a specific user might look like this:

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

The hook will re-render every time the resulting `data` changes (compared deep equality). Use this pattern when you want the host to push data to the client. **Don't** use this pattern if the parameter values (`{ user: "joel" }` in the example) change often. For subscriptions, routes are bound to concrete parameter values, so changing the parameters forces the hook to unsubscribe and re-subscribe.

The `useRoute` hook can also fetch routes without subscribing to them. Pass a `{ subscribe: false }` options object as the third argument and the hook will use regulular HTTP GET requests, re-fetching the route data every time any of the parameter values change (and only then).

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

In an example Ethereum app with a `createPost(args: { content: string })` action, using `useSession` with `wagmi` might look like this:

```tsx
import { useProvider, useSigner, useNetwork } from "wagmi"
import { EthereumChainImplementation } from "@canvas-js/ethereum"

// class EthereumChainImplementation implements ChainImplementation<ethers.providers.JsonRpcSigner, ethers.Wallet> {
//   constructor(chainId: string, provider?: ethers.providers.JsonRpcProvider)
// }

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
