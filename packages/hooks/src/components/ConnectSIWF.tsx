import "@farcaster/auth-kit/styles.css"

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { hexlify, getBytes } from "ethers"
import { Canvas } from "@canvas-js/core"
import { SIWFSigner } from "@canvas-js/signer-ethereum"
import { AuthClientError, SignInButton, useProfile, UseSignInData } from "@farcaster/auth-kit"
import { sdk } from "@farcaster/frame-sdk"
import { bytesToHex } from "@noble/hashes/utils"
import { CanvasContext } from "../CanvasContext.js"

export interface ConnectSIWFProps {
	app: Canvas<any>
}

export const ConnectSIWF: React.FC<ConnectSIWFProps> = ({ app }) => {
	const { sessionSigner, setSessionSigner, address, setAddress } = useContext(CanvasContext)

	useEffect(() => {
		sdk.actions.ready()
	}, [])

	const profile = useProfile()
	const {
		isAuthenticated: farcasterIsAuthenticated,
		profile: { fid, displayName, custody },
	} = profile

	// requestId for browser SIWF, nonce for frame-based SIWF; only used for new sessions
	const [requestId, setRequestId] = useState<string | null>(null)
	const [nonce, setNonce] = useState<string | null>(null)
	const [newSessionPrivateKey, setNewSessionPrivateKey] = useState<string | null>(null)

	const [error, setError] = useState<Error | null>(null)
	const initializedRef = useRef(false)

	const [canvasIsAuthenticated, setCanvasIsAuthenticated] = useState(false)
	useEffect(() => {
		;(async () => {
			const hasSession = await app?.signers
				.getAll()
				.filter((s) => s.key === "signer-ethereum-farcaster")[0]
				?.hasSession(app.topic)
			setCanvasIsAuthenticated(hasSession ?? false)
		})()
	}, [app, app?.topic, sessionSigner])

	useEffect(() => {
		if (initializedRef.current) return
		initializedRef.current = true

		if (!app || !app.topic) return

		const topic = app.topic
		const siwf = new SIWFSigner()
		const restored = siwf.restoreSIWFSession(topic)
		if (restored !== null) {
			const { payload, signer: delegateSigner } = restored

			const sessionSigner = new SIWFSigner({
				custodyAddress: siwf.getAddressFromDid(payload.did),
				privateKey: bytesToHex(delegateSigner.export().privateKey),
			})
			setAddress(payload.did)
			setSessionSigner(sessionSigner)

			// TODO: this should already be on the log
			app.messageLog.append(payload, { signer: delegateSigner })

			app.updateSigners([
				sessionSigner,
				...app.signers.getAll().filter((signer) => signer.key !== "signer-ethereum-farcaster"),
			])
			console.log("started restored SIWF session")
		}

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
	}, [app, app?.topic])

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
		app.updateSigners([signer, ...app.signers.getAll().filter((signer) => signer.key !== "signer-ethereum-farcaster")])
		app.messageLog.append(payload, { signer: delegateSigner })
		console.log("started SIWF session inside frame", authorizationData)
	}, [app, app?.topic, nonce, newSessionPrivateKey])

	const browserSignIn = useCallback(
		async (result: UseSignInData) => {
			if (!app || !newSessionPrivateKey) return

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
			const otherSigners = app.signers.getAll().filter((signer) => signer.key !== "signer-ethereum-farcaster")
			app.updateSigners([signer, ...otherSigners])
			app.messageLog.append(payload, { signer: delegateSigner })
			console.log("started SIWF session", authorizationData)
		},
		[app, app?.topic, newSessionPrivateKey],
	)

	const signOut = useCallback(() => {
		if (!app || !app.topic) return
		sessionSigner?.clearSession(app.topic)
		setAddress(null)
		setSessionSigner(null)
		const otherSigners = app.signers.getAll().filter((signer) => signer.key !== "signer-ethereum-farcaster")
		app.updateSigners([...otherSigners, new SIWFSigner()])
	}, [app, app?.topic, sessionSigner])

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
				{/* TODO: combine these states, currently Canvas logins and Farcaster logins are separate. */}
				{canvasIsAuthenticated && (
					<div>
						<button
							type="submit"
							className="w-full p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200"
							onClick={signOut}
						>
							Disconnect Farcaster
						</button>
					</div>
				)}
				{farcasterIsAuthenticated && (
					<p>
						Created new Farcaster session: {displayName} (FID: {fid}, Custody: {custody?.slice(0, 6)})
					</p>
				)}
				{/* frame login */}
				{nonce && !farcasterIsAuthenticated && !canvasIsAuthenticated && (
					<button
						type="submit"
						className="w-full p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200"
						onClick={frameSignIn}
					>
						Sign in with Farcaster (Frame)
					</button>
				)}
				{/* non-frame login */}
				{requestId && !farcasterIsAuthenticated && !canvasIsAuthenticated && (
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
