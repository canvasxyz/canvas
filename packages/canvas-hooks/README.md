# @canvas-js/hooks

React hooks for using Canvas in your frontend application.

To use the Canvas hooks, you must first wrap your application in a parent `Canvas` element, which initializes state and sets an internal React context for the hooks to use. The only thing you have to pass the `Canvas` element is a `host: string` URL of a canvas app's HTTP API server.

```tsx
<Canvas host="http://localhost:8000">
	<MyApp />
</Canvas>
```

Next, in just one location in your app (ideally a dedicated login/authentication component), acquire an `ethers.providers.JsonRpcSigner` for the user and pass it into the Canvas `useSession` hook. This example uses `wagmi` and assumes the the user has already connected using the wagmi `useConnect()` hook.

```tsx
import React from "react"

import { ethers } from "ethers"
import { useSigner } from "wagmi"
import { useSession } from "@canvas-js/hooks"

const Login: React.FC<{}> = ({}) => {
	const { error: signerError, data: signer } = useSigner<ethers.providers.JsonRpcSigner>()

	const {
		error: sessionError,
		sessionAddress,
		sessionExpiration,
		login,
		logout,
		isLoading,
		isPending,
	} = useSession(signer ?? null)

	if (sessionAddress === null) {
		return (
			<div>
				{isLoading ? <p>Loading...</p> : <p>Click Login to begin a new session.</p>}
				<button disabled={isLoading || isPending} onClick={login}>
					Login
				</button>
			</div>
		)
	} else {
		return (
			<div>
				<p>Using session {sessionAddress}.</p>
				<button disabled={isLoading} onClick={logout}>
					Logout
				</button>
			</div>
		)
	}
}
```

`useSession` returns some status values along with `login()` and `logout()` methods. `login()` creates a new session and stores it in localStorage and an internal React context; `logout()` reset the context value and clears localStorage.

You only need to include `useSession` in one place in your entire application, and it should attach natually to the regular wallet connect flow.

The `useCanvas` can be imported any number of times anywhere throughout your application. `useCanvas` returns metadata about the connected application, and an async `dispatch()` method that is used to create and send actions.

```tsx
import { useCallback } from "react"
import { useCanvas } from "@canvas-js/hooks"

export function SomeComponent(props: {}) {
	const { isReady, dispatch } = useCanvas()

	const [count, setCount] = useState(0)

	const handleClick = useCallback(() => {
		dispatch("poke", count)
		setCount(count + 1)
	}, [dispatch, count])

	return <button disabled={isReady} onClick={handleClick}></button>
}
```

Here, when the button is clicked, we dispatch a `poke` action with a single integer argument. The signing, timestamp, current block, and so on are all handled internally by the dispatch method using the session wallet held by the internal React context.

Lastly, to subscribe to a route, pass the `useRoute` a string route and an object of params. `useRoute` works like the `useSWR` hook, returning an error or an array of results. Internally, it uses the [EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource).

```ts
declare function useSession(signer: ethers.providers.JsonRpcSigner | null): {
	error: Error | null
	isLoading: boolean
	isPending: boolean
	sessionAddress: string | null
	sessionExpiration: number | null
	login: () => void
	logout: () => void
}

declare function useCanvas(): {
	dispatch: (call: string, ...args: (null | boolean | number | string)[]) => Promise<{ hash: string }>
	isLoading: boolean
	isPending: boolean
	isReady: boolean
	error: Error | null
	host: string | null
	data: {
		cid: string
		uri: string
		component: string | null
		actions: string[]
		routes: string[]
	} | null
}

declare function useRoute<T = Record<string, null | boolean | number | string>>(
	route: string,
	params: Record<string, string>
): {
	error: Error | null
	data: T[] | null
}
```

(c) 2022 Canvas Technology Corporation
