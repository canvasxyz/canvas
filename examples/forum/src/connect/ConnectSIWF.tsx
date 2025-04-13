import "@farcaster/auth-kit/styles.css"

import React, { useCallback, useContext, useEffect, useRef, useState } from "react"
import { hexlify, getBytes } from "ethers"
import { SIWFSigner } from "@canvas-js/chain-ethereum"
import { AuthClientError, SignInButton, useProfile, UseSignInData } from "@farcaster/auth-kit"
import { sdk } from "@farcaster/frame-sdk"

import { AppContext } from "../AppContext.js"
import { Canvas } from "@canvas-js/core"

export interface ConnectSIWFProps {
	topic: string
}

export const ConnectSIWF: React.FC<ConnectSIWFProps> = ({ topic }) => {
	const { app, setSessionSigner, setAddress } = useContext(AppContext)

	const profile = useProfile()
	const {
		isAuthenticated,
		profile: { fid, displayName, custody },
	} = profile

	// requestId for browser SIWF, nonce for frame-based SIWF
	const [requestId, setRequestId] = useState<string | null>(null)
	const [nonce, setNonce] = useState<string | null>(null)
	const [newSessionPrivateKey, setNewSessionPrivateKey] = useState<string | null>(null)

	const [error, setError] = useState<Error | null>(null)
	const initializedRef = useRef(false)

	useEffect(() => {
		if (initializedRef.current) return
		initializedRef.current = true

		if (!app) return

		const sig = new SIWFSigner()
		sig.restoreSIWFSession(topic).then(() => {
			console.log('restored')
		})

		sdk.context
			.then((frameContext) => {
				if (frameContext) {
					// inside a frame
					const { nonce, privateKey } = SIWFSigner.newSIWFRequestNonce(topic)
					setNonce(nonce)
					setNewSessionPrivateKey(hexlify(privateKey))
					sdk.actions.ready()
				} else {
					// inside the browser
					const { requestId, privateKey } = SIWFSigner.newSIWFRequestId(topic)
					setRequestId(requestId)
					setNewSessionPrivateKey(hexlify(privateKey))
				}
			})
			.catch((err) => {
				alert("Error initializing FrameSDK, application may be out of date.")
			})
	}, [topic])

	const frameSignIn = useCallback(async () => {
		if (!app || !nonce || !newSessionPrivateKey) return

		const now = new Date()
		const exp = new Date(now.getTime() + 10 * 60 * 1000)

		const result = await sdk.actions
			.signIn({
				nonce,
				notBefore: now.toISOString(),
				expirationTime: exp.toISOString(),
			})
			.catch((err) => {
				const message = err.message
				alert(`SIWF frame sign-in error: ${message}`)
				throw err
			})

		const { message, signature } = result

		const { authorizationData, topic, custodyAddress } = SIWFSigner.parseSIWFMessage(message, signature)
		const signer = new SIWFSigner({ custodyAddress, privateKey: newSessionPrivateKey.slice(2) })

		const address = await signer.getDid()
		const timestamp = new Date(authorizationData.siweIssuedAt).valueOf()
		const { payload, signer: delegateSigner } = await signer
			.newSIWFSession(topic, authorizationData, timestamp, getBytes(newSessionPrivateKey))
			.catch((err) => {
				const message = err.message
				alert(`SIWF new session error: ${message}`)
				throw err
			})
		setAddress(address)
		setSessionSigner(signer)
		app.updateSigners([
			signer,
			...app.signers.getAll().filter((signer) => signer.key !== "chain-ethereum-farcaster"),
		])
		app.messageLog.append(payload, { signer: delegateSigner })
		console.log("started SIWF chat session inside frame", authorizationData)
	}, [app, nonce, newSessionPrivateKey, topic])

	const browserSignIn = useCallback(async (result: UseSignInData) => {
		if (!app || !nonce || !newSessionPrivateKey) return

		const { signature, message } = result
		if (!message || !signature) {
			setError(new Error("login succeeded but did not return a valid SIWF message"))
			return
		}

		const { authorizationData, topic, custodyAddress } = SIWFSigner.parseSIWFMessage(message, signature)
		const signer = new SIWFSigner({ custodyAddress, privateKey: newSessionPrivateKey.slice(2) })
		const address = await signer.getDid()

		const timestamp = new Date(authorizationData.siweIssuedAt).valueOf()
		const { payload, signer: delegateSigner } = await signer.newSIWFSession(
			topic,
			authorizationData,
			timestamp,
			getBytes(newSessionPrivateKey),
		)
		setAddress(address)
		setSessionSigner(signer)
		app.updateSigners([
			signer,
			...app.signers.getAll().filter((signer) => signer.key !== "chain-ethereum-farcaster"),
		])
		app.messageLog.append(payload, { signer: delegateSigner })
		console.log("started SIWF chat session", authorizationData)
	}, [app, nonce, newSessionPrivateKey, topic])

	if (error !== null) {
		return (
			<div className="p-2 border rounded bg-red-100 text-sm">
				<code>{error.message}</code>
			</div>
		)
	} else if (!newSessionPrivateKey || (!requestId && !nonce) || !app) {
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
						{displayName} (FID: {fid}, Custody: {custody?.slice(0, 6)})
					</div>
				)}
				{/* frame login */}
				{nonce && !isAuthenticated && (
					<button
						type="submit"
						className="w-full p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200"
						onClick={frameSignIn}
					>
						Sign in with Farcaster (Frame)
					</button>
				)}
				{/* non-frame login */}
				{requestId && !isAuthenticated && (
					<SignInButton
						requestId={requestId}
						onSuccess={browserSignIn}
						onError={(error: AuthClientError | undefined) => {
							console.log("Browser SIWF login error:", error)
						}}
						onSignOut={() => {
							setAddress(null)
							setSessionSigner(null)
						}}
					/>
				)}
			</div>
		)
	}
}
