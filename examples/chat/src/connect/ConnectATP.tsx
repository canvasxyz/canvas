import React, { useCallback, useContext, useMemo, useState } from "react"
import { EventEmitter } from "@libp2p/interface/events"
import { ATPSigner } from "@canvas-js/chain-atp"

import { AppContext } from "../AppContext.js"

export interface ConnectATPProps {}

export const ConnectATP: React.FC<ConnectATPProps> = ({}) => {
	const { app, sessionSigner, setSessionSigner, address, setAddress } = useContext(AppContext)

	const [error, setError] = useState<Error | null>(null)
	const [handle, setHandle] = useState("")
	const [password, setPassword] = useState("")

	const [showLoginForm, setShowLoginForm] = useState(false)

	const eventEmitter = useMemo(
		() => new EventEmitter<{ login: CustomEvent<{ identifier: string; password: string }> }>(),
		[]
	)

	const signer = useMemo(
		() =>
			new ATPSigner({
				login: () => {
					setShowLoginForm(true)
					return new Promise<{ identifier: string; password: string }>((resolve, reject) =>
						eventEmitter.addEventListener(
							"login",
							({ detail: { identifier, password } }) => resolve({ identifier, password }),
							{ once: true }
						)
					)
				},
			}),
		[]
	)

	const connect = useCallback(async () => {
		if (app === null) {
			setError(new Error("app not initialized"))
			return
		}

		const { address } = await signer.getSession(app.topic)
		setAddress(address)
		setSessionSigner(signer)
	}, [app])

	const disconnect = useCallback(async () => {
		setAddress(null)
		setSessionSigner(null)
	}, [sessionSigner])

	if (error !== null) {
		return (
			<div className="p-2 border rounded bg-red-100 text-sm">
				<code>{error.message}</code>
			</div>
		)
	} else if (address !== null && sessionSigner instanceof ATPSigner) {
		return (
			<button
				onClick={() => disconnect()}
				className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200"
			>
				Disconnect BlueSky account
			</button>
		)
	} else if (showLoginForm) {
		return (
			<div className="border rounded">
				<form className="p-2 flex flex-col items-stretch gap-2">
					<div className="flex flex-col items-stretch">
						<label className="block" htmlFor="bsky-identifier">
							Handle
						</label>
						<input
							className="px-1 block border rounded-sm"
							id="bsky-identifier"
							type="text"
							value={handle}
							onChange={(e) => setHandle(e.target.value)}
						/>
					</div>

					<div className="flex flex-col items-stretch">
						<label className="block" htmlFor="bsky-app-password">
							App password
						</label>
						<input
							className="px-1 block border rounded-sm"
							id="bsky-app-password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
						/>
					</div>

					<p className="text-sm w-96">
						This will post a verification message to your feed, retrieve the signed commit containing the post record,
						and then delete the message.
					</p>
				</form>

				<button
					className="p-2 block w-full border-t hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200"
					onClick={() =>
						eventEmitter.dispatchEvent(new CustomEvent("login", { detail: { identifier: handle, password } }))
					}
				>
					Log in
				</button>
			</div>
		)
	} else {
		return (
			<button
				onClick={() => connect()}
				className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200"
			>
				Connect BlueSky account
			</button>
		)
	}
}
