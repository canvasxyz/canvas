import React, { useCallback, useContext, useEffect, useRef, useState } from "react"

import { ATPSigner } from "@canvas-js/chain-atp"

import { AppContext } from "./AppContext.js"
import { sessionStore } from "./utils.js"

export interface ConnectATPProps {}

export const ConnectATP: React.FC<ConnectATPProps> = ({}) => {
	const { app, sessionSigner, setSessionSigner, address, setAddress } = useContext(AppContext)

	const [error, setError] = useState<Error | null>(null)
	const [handle, setHandle] = useState("")
	const [password, setPassword] = useState("")

	const connect = useCallback(
		async (handle: string, password: string) => {
			if (app === null) {
				setError(new Error("app not initialized"))
				return
			}

			try {
				const signer = new ATPSigner({
					store: sessionStore,
					login: async () => ({ identifier: handle, password: password }),
				})

				const { address } = await signer.getSession(app.topic)
				setAddress(address)
				setSessionSigner(signer)
			} catch (err) {
				if (err instanceof Error) {
					setError(err)
				} else {
					throw err
				}
			}
		},
		[app]
	)

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
			<div className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200">
				<button onClick={() => disconnect()}>Disconnect BlueSky</button>
			</div>
		)
	} else if (address === null) {
		return (
			<div className="border rounded">
				<div className="p-2 border-b">Connect BlueSky</div>
				<form className="p-2 flex flex-col items-stretch">
					<label className="block" htmlFor="bsky-identifier">
						Handle
					</label>
					<input
						className="px-1 block border"
						id="bsky-identifier"
						type="text"
						value={handle}
						onChange={(e) => setHandle(e.target.value)}
					/>

					<label className="block" htmlFor="bsky-app-password">
						App password
					</label>
					<input
						className="px-1 block border"
						id="bsky-app-password"
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
					/>
				</form>

				<button
					className="p-2 block w-full border-t hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200"
					onClick={() => connect(handle, password)}
				>
					Log in
				</button>
			</div>
		)
	} else {
		return (
			<div className="p-2 border rounded bg-gray-100 text-gray-600">
				<button disabled>Connect BlueSky</button>
			</div>
		)
	}
}
