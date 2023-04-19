# Canvas React Hooks

Canvas provides React hooks for using Canvas in your frontend application.

The React hooks are currently developed for Ethereum-compatible chains, using [Ethers v5](https://docs.ethers.org/v5/) and [wagmi](https://wagmi.sh/).

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
  - [`<Canvas />`](#canvas)
  - [`useCanvas()`](#usecanvas)
  - [`useRoute(route, options)`](#useroute)
  - [`useSession(chainImplementation, signer)`](#usesession)
- [API](#api)

## Installation

```
$ npm i @canvas-js/hooks
```

## Usage

### `<Canvas />`

To use the Canvas hooks, you must first wrap your application in a parent `Canvas` element, which initializes state and sets an internal React context for the hooks to use. The only thing you have to pass the `Canvas` element is a `host: string` URL of a canvas app's HTTP API server.

```tsx
<Canvas host="http://localhost:8000">
  <MyApp />
</Canvas>
```

### `useCanvas`

You can access metadata about the host, and the application the host is serving, using the `useCanvas` hook anywhere inside the parent `Canvas` element.

```tsx
import { useCanvas } from "@canvas-js/hooks"

function MyApp({}) {
  const { isLoading, error, data } = useCanvas()

  return <div>{/* ...*/}</div>
}
```

`isLoading` is initially `true` while the hook makes an initial HTTP request for application metadata, and then sets to `false` when either `data` or `error` is non-null.

```ts
type ApplicationData = {
  cid: string
  uri: string
  peerId: string | null
  actions: string[]
  routes: string[]
  chains: string[]
  peers: { id: string; protocols?: string[]; addresses?: string[] }[]
  merkleRoots: Record<string, string>
}

export function useCanvas(): {
  isLoading: boolean
  error: Error | null
  data: ApplicationData | null
}
```

### `useRoute`

You can use `useRoute` to subscribe to data from your application's routes. Subscriptions are real-time by default.

For example, this subscribes to the `/posts/:user` route with the `:user` parameter set to `"joel"`.

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

The hook will re-render every time server processes a new batch of actions and pushes an `update` event to the client. The hook will also re-render any time the parameter values change. Use this pattern when you want the host to push data to the client.
 
You can also provide a callback to the hook, which will be triggered whenever new data is returned from the hook. **If you do this, make sure to memoize your callback (i.e. wrap it in `useCallback()`)!**

The `useRoute` hook can also fetch routes without subscribing to them. Pass a `{ subscribe: false }` options object as the third argument and the hook will only re-fetch the route when the parameter values change.

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

### `useSession`

`useSession` takes , and exposes `login()`, `logout()`, and `client[action]()` convenience methods for creating and dispatching actions

For example:

```tsx
import { useProvider, useSigner, useNetwork } from "wagmi"
import { EthereumChainImplementation } from "@canvas-js/ethereum"

function MyApp({}) {
  const provider = useProvider<ethers.providers.JsonRpcProvider>()
  const { error, data: signer } = useSigner<ethers.providers.JsonRpcSigner>()
  const { chain } = useNetwork()

  const chainImplementation = useMemo(
    () => chain?.id && new EthereumChainImplementation(chain.id, provider),
    [provider, chain?.id]
  )

  const { login, logout, sessionAddress, sessionExpiration, client } = useSession(chainImplementation, signer)

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

The `useSession` hook is always in one of the following three states:

- `isLoading === true`: waiting for application data from host, & checking localStorage for sessionObject
- `isLoading === false && sessionAddress === null`: logged out, need to call `login()`
- `isLoading === false && sessionAddress !== null`: we have a session and `client` will be non-null

`client`, `sessionAddress`, and `sessionExpiration` are either all null or all non-null.

## API

```ts
import { ChainImplementation, ActionArgument } from "@canvas-js/interfaces"
import { ModelValue } from "@canvas-js/interfaces"

export function useRoute<T extends Record<string, ModelValue> = Record<string, ModelValue>>(
  route: string,
  params: Record<string, ModelValue>,
  options: { subscribe?: boolean } = { subscribe: true }
): { error: Error | null; isLoading: boolean; data: T[] | null }


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
  login: () => Promise<void>
  logout: () => Promise<void>
  client: Client | null
}

```