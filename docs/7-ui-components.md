# UI Components

We provide React components that provide an additional layer of
abstraction above session signers, for users to be able to log in/out
of your application.

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
import { ConnectSIWE } from "@canvas-js/hooks/components"

const MyComponent = () => {
	const app = useCanvas(...)
	const buttonStyles = { ... }

	return <div className="user-login">
		<ConnectSIWE app={app} buttonStyles={buttonStyles} />
		<ConnectSIWF app={app} buttonStyles={buttonStyles} />
	</div>
}
```

## Other Considerations

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
	<AuthKitProvider>
		<AuthKitProvider config={farcasterConfig}>
			<App />
		</AuthKitProvider>
	</AuthKitProvider>
)
```
