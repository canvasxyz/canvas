import "@farcaster/auth-kit/styles.css"

import React, { useContext, useEffect, useRef, useState } from "react"
import { hexlify, getBytes } from "ethers"
import { SIWFSigner } from "@canvas-js/signer-ethereum"
import { SignInButton, useProfile } from "@farcaster/auth-kit"
import FrameSDK from "@farcaster/frame-sdk"

import { AppContext } from "../AppContext.js"

export interface ConnectSIWFProps {
	topic: string
	frame?: boolean
}

export const ConnectSIWF: React.FC<ConnectSIWFProps> = ({ topic, frame }) => {
	const { app, setSessionSigner, setAddress } = useContext(AppContext)

	const profile = useProfile()
	const {
		isAuthenticated,
		profile: { fid, displayName, custody, verifications },
	} = profile

	const [privateKey, setPrivateKey] = useState<string | null>(null)
	const [error, setError] = useState<Error | null>(null)

	// requestId for vanilla SIWF, nonce for frame-based SIWF
	const [requestId, setRequestId] = useState<string | null>(null)
	const [nonce, setNonce] = useState<string | null>(null)

	const initialRef = useRef(false)
	useEffect(() => {
		if (initialRef.current) {
			return
		}

		initialRef.current = true

		if (frame) {
			const { nonce, privateKey } = SIWFSigner.newSIWFRequestNonce(topic)
			setNonce(nonce)
			setPrivateKey(hexlify(privateKey))
			;(FrameSDK as any).actions.ready()
		} else {
			const { requestId, privateKey } = SIWFSigner.newSIWFRequestId(topic)
			setRequestId(requestId)
			setPrivateKey(hexlify(privateKey))
		}
	}, [])

	if (error !== null) {
		return (
			<div className="p-2 border rounded bg-red-100 text-sm">
				<code>{error.message}</code>
			</div>
		)
	} else if (!privateKey || (!requestId && !nonce) || !app) {
		return (
			<div className="p-2 border rounded bg-gray-200">
				<button disabled>Loading...</button>
			</div>
		)
	} else {
		return (
			<div>
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
				{/* frame login */}
				{nonce && (
					<button
						type="submit"
						style={{ background: "#eee", padding: "10px 12px" }}
						onClick={async () => {
							const now = new Date()
							const exp = new Date(now.getTime() + 10 * 60 * 1000)

							const result = await (FrameSDK as any).actions.signIn({
								nonce,
								notBefore: now.toISOString(),
								expirationTime: exp.toISOString(),
							})

							const { message, signature } = result

							const { authorizationData, topic, custodyAddress } = SIWFSigner.parseSIWFMessage(message, signature)
							const signer = new SIWFSigner({ custodyAddress, privateKey: privateKey.slice(2) })

							const address = await signer.getDid()
							const timestamp = new Date(authorizationData.siweIssuedAt).valueOf()
							const { payload, signer: delegateSigner } = await signer.newSIWFSession(
								topic,
								authorizationData,
								timestamp,
								getBytes(privateKey),
							)
							setAddress(address)
							setSessionSigner(signer)
							app.updateSigners([
								signer,
								...app.signers.getAll().filter((signer) => signer.key !== "signer-ethereum-farcaster"),
							])
							app.messageLog.append(payload, { signer: delegateSigner })
							console.log("started SIWF chat session inside frame", authorizationData)
						}}
					>
						Sign in with Farcaster
					</button>
				)}
				{/* non-frame login */}
				{requestId && (
					<SignInButton
						requestId={requestId}
						onSuccess={async (result) => {
							const { signature, message } = result
							if (!message || !signature) {
								setError(new Error("login succeeded but did not return a valid SIWF message"))
								return
							}

							const { authorizationData, topic, custodyAddress } = SIWFSigner.parseSIWFMessage(message, signature)
							const signer = new SIWFSigner({ custodyAddress, privateKey: privateKey.slice(2) })
							const address = await signer.getDid()

							const timestamp = new Date(authorizationData.siweIssuedAt).valueOf()
							const { payload, signer: delegateSigner } = await signer.newSIWFSession(
								topic,
								authorizationData,
								timestamp,
								getBytes(privateKey),
							)
							setAddress(address)
							setSessionSigner(signer)
							app.updateSigners([
								signer,
								...app.signers.getAll().filter((signer) => signer.key !== "signer-ethereum-farcaster"),
							])
							app.messageLog.append(payload, { signer: delegateSigner })
							console.log("started SIWF chat session", authorizationData)
						}}
						onError={(...args) => {
							console.log("received SIWF error", args)
						}}
						onSignOut={(...args) => {
							setAddress(null)
							setSessionSigner(null)
						}}
					/>
				)}
			</div>
		)
	}
}
