import "@farcaster/auth-kit/styles.css"

import React, { useContext, useEffect, useRef, useState } from "react"
import { hexlify, getBytes } from "ethers"
import { SIWFSigner } from "@canvas-js/chain-ethereum"
import { ed25519 } from "@canvas-js/signatures"
import { SignInButton, useProfile } from "@farcaster/auth-kit"

import { topic } from "../App.js"
import { AppContext } from "../AppContext.js"

export interface ConnectSIWFProps {}

export const ConnectSIWF: React.FC<ConnectSIWFProps> = ({}) => {
	const { app, setSessionSigner, setAddress } = useContext(AppContext)

	const profile = useProfile()
	const {
		isAuthenticated,
		profile: { fid, displayName, custody, verifications },
	} = profile

	const [error, setError] = useState<Error | null>(null)
	const [requestId, setRequestId] = useState<string | null>(null)
	const [privateKey, setPrivateKey] = useState<string | null>(null)

	const initialRef = useRef(false)
	useEffect(() => {
		if (initialRef.current) {
			return
		}

		initialRef.current = true

		const { requestId, privateKey } = SIWFSigner.newSIWFRequestId(topic)
		setRequestId(requestId)
		setPrivateKey(hexlify(privateKey))
	}, [])

	if (error !== null) {
		return (
			<div className="p-2 border rounded bg-red-100 text-sm">
				<code>{error.message}</code>
			</div>
		)
	} else if (!privateKey || !requestId || !app) {
		return (
			<div className="p-2 border rounded bg-gray-200">
				<button disabled>Loading...</button>
			</div>
		)
	} else {
		return (
			<div style={{ marginTop: "12px", right: "12px" }}>
				{isAuthenticated && (
					<div>
						<p>
							Hello, {displayName}! Your FID is {fid}.
						</p>
						<p>Your custody address is: </p>
						<pre>{custody}</pre>
						<p>Your connected signers: </p>
						{verifications?.map((v, i) => <pre key={i}>{v}</pre>)}
					</div>
				)}
				<SignInButton
					requestId={requestId}
					onSuccess={async (result) => {
						const { signature, message } = result
						if (!message || !signature) {
							setError(new Error("login succeeded but did not return a valid SIWF message"))
							return
						}
						console.log("received SIWF message from farcaster relay:")
						console.log(message, signature, privateKey)

						const { authorizationData, topic, custodyAddress } = SIWFSigner.parseSIWFMessage(message, signature)
						const signer = new SIWFSigner({ custodyAddress, privateKey: privateKey.slice(2) })
						const address = await signer.getDid()

						const timestamp = new Date(authorizationData.siweIssuedAt).valueOf()
						const { payload, signer: delegateSigner } = await signer.newSession(
							topic,
							authorizationData,
							timestamp,
							ed25519.type,
							getBytes(privateKey),
						)
						setAddress(address)
						setSessionSigner(signer)
						app.updateSigners([signer, ...app.signers.getAll().filter((signer) => signer.key !== "chain-ethereum-farcaster")])
						app.messageLog.append(payload, { signer: delegateSigner })
						console.log("created chat session", payload, delegateSigner)
					}}
					onError={(...args) => {
						console.log("received SIWF error", args)
					}}
					onSignOut={(...args) => {
						setAddress(null)
						setSessionSigner(null)
					}}
				/>
			</div>
		)
	}
}
