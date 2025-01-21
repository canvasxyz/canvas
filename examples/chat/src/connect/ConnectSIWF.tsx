import "@farcaster/auth-kit/styles.css"

import React, { useCallback, useContext, useEffect, useRef, useState } from "react"
import { JsonRpcProvider, Eip1193Provider, BrowserProvider, EventEmitterable } from "ethers"
// import { providers } from "ethers"

import { SIWFSigner } from "@canvas-js/chain-ethereum"
import { AuthKitProvider, SignInButton, useProfile } from "@farcaster/auth-kit"

import { topic } from "../App.js"
import { AppContext } from "../AppContext.js"

// declare global {
// 	// eslint-disable-next-line no-var
// 	var ethereum: undefined | null | (Eip1193Provider & EventEmitterable<"accountsChanged" | "chainChanged">)
// }

export interface ConnectSIWFProps {}

export const ConnectSIWF: React.FC<ConnectSIWFProps> = ({}) => {
	const { app, sessionSigner, setSessionSigner, address, setAddress } = useContext(AppContext)

	const profile = useProfile()
	const {
		isAuthenticated,
		profile: { fid, displayName, custody, verifications },
	} = profile

	const [error, setError] = useState<Error | null>(null)
	const [signer, setSigner] = useState<SIWFSigner | null>(null)
	const [requestId, setRequestId] = useState<string | null>(null)

	const initialRef = useRef(false)
	useEffect(() => {
		if (initialRef.current) {
			return
		}

		initialRef.current = true

		const signer = new SIWFSigner()
		signer.getSIWFRequestId(topic).then((requestId) => {
			setSigner(signer)
			setRequestId(requestId)
		})
	}, [])

	const disconnect = useCallback(async () => {
		// setAddress(null)
		// setSessionSigner(null)
	}, [sessionSigner])

	if (error !== null) {
		return (
			<div className="p-2 border rounded bg-red-100 text-sm">
				<code>{error.message}</code>
			</div>
		)
	} else if (!signer || !requestId) {
		return (
			<div className="p-2 border rounded bg-gray-200">
				<button disabled>Loading...</button>
			</div>
		)
	} else {
		return (
			<div style={{ marginTop: "12px", right: "12px" }}>
				{isAuthenticated ? (
					<div>
						<p>
							Hello, {displayName}! Your FID is {fid}.
						</p>
						<p>Your custody address is: </p>
						<pre>{custody}</pre>
						<p>Your connected signers: </p>
						{verifications?.map((v, i) => <pre key={i}>{v}</pre>)}
					</div>
				) : (
					<SignInButton
						requestId={requestId}
						onSuccess={(result) => {
							const {
								custody,
								signature,
								message,
								signatureParams: { domain, nonce, siweUri },
							} = result
							// ...
							console.log("success", result)
						}}
						onError={(...args) => {
							console.log("error", args)
						}}
						onSignOut={(...args) => {
							console.log("onSignOut", args)
						}}
					/>
				)}
			</div>
		)
	}
}
