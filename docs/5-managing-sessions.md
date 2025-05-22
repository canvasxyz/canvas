# Managing Sessions

We provide React components for managing users' sessions, so they
can log in and out of your application with one click.

These are built as a layer of abstraction above session signers.
Currently, these components support signing in with Ethereum and Farcaster.

## Adding the Auth Provider

In the file where your React application is configured, wrap your
application with AuthProvider:

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

## Using Auth Components

Now you can use any of the provided auth components in your application:

- The `ConnectSIWE` component supports in-browser Ethereum wallets.
- The `ConnectSIWF` component supports in-browser and in-frame Farcaster miniapps.

Each one will render a button, which toggles between logged-in and
logged-out states, which you can customize with your own styles.

```ts
import { useSIWE } from "@canvas-js/hooks/components"
import { Chat } from "./contract"

const MyComponent = () => {
	const { app } = useCanvas({
	  topic: "example.xyz",
	  contract: Chat
	})
	const buttonStyles = { ... }

  const { ConnectSIWE } = useSIWE(app)
  const { ConnectSIWF } = useSIWF(app)

	return <div className="user-login">
		<ConnectSIWE app={app} buttonStyles={buttonStyles} />
		<ConnectSIWF app={app} buttonStyles={buttonStyles} />
	</div>
}
```

Make sure that these hooks are called at a lower level component than
`AuthProvider`. If you use the hooks in the same component where
AuthProvider is used, they won't work.

## Other considerations

If you are using SIWFSigner, you'll need to wrap your application in
the provider given to you by @farcaster/auth-kit.

For miniapp frames, you'll also need to set up
.well-known/farcaster.json in your app's public directory.

```ts
import { AuthKitProvider } from "@farcaster/auth-kit"

const root = ReactDOM.createRoot(document.getElementById("root")!)
const config = {
	// insert farcaster auth config...
}

root.render(
	<AuthProvider>
		<AuthKitProvider config={farcasterConfig}>
			<App />
		</AuthKitProvider>
	</AuthProvider>
)
```