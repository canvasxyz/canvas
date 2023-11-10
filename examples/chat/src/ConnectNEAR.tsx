import React, { useCallback, useContext, useEffect, useState } from "react"

import { Buffer } from "buffer"
import { setupWalletSelector } from "@near-wallet-selector/core"
import { setupModal } from "@near-wallet-selector/modal-ui"
// import { setupNearWallet } from "@near-wallet-selector/near-wallet"
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet"

import { NEARSigner } from "@canvas-js/chain-near"

import { AppContext } from "./AppContext.js"
import { sessionStore } from "./utils.js"

import "@near-wallet-selector/modal-ui/styles.css"
import { assert } from "@canvas-js/signed-cid/src/utils.js"

export interface ConnectNEARProps {
	network: string
	recipient: string
}

export const ConnectNEAR: React.FC<ConnectNEARProps> = ({ network, recipient }) => {
	const { app, sessionSigner, setSessionSigner, address, setAddress } = useContext(AppContext)
	// const [nearConnection, setNearConnection] = useState<Near | null>(null)

	const [error, setError] = useState<Error | null>(null)
	const [handle, setHandle] = useState("")

	useEffect(() => {
		console.log(window.location)
		console.log(window.location.search)

		// the signed data is in the url hash fragment

		const urlParams = new URLSearchParams(window.location.search)

		if (urlParams.get("finishNearLogin") === "true") {
			console.log("finishNearLogin")
			const hashData = window.location.hash.replace(/^#/g, "")
			const hashParams = new URLSearchParams(hashData)

			const signature = hashParams.get("signature")
			assert(signature !== null, `signature is null`)
			const publicKey = hashParams.get("publicKey")
			assert(publicKey !== null, `publicKey is null`)

			const walletAddress = urlParams.get("walletAddress")
			assert(walletAddress !== null, `walletAddress is null`)
			const chainId = urlParams.get("chainId")
			assert(chainId !== null, `chainId is null`)
			const uri = urlParams.get("uri")
			assert(uri !== null, `uri is null`)
			const issuedAt = urlParams.get("issuedAt")
			assert(issuedAt !== null, `issuedAt is null`)
			let expirationTime = urlParams.get("expirationTime")
			expirationTime = expirationTime == "null" ? null : expirationTime
			const recipient = urlParams.get("recipient")
			assert(recipient !== null, `recipient is null`)
			const nonce = urlParams.get("nonce")
			assert(nonce !== null, `nonce is null`)
			const message = { walletAddress, chainId, uri, issuedAt, expirationTime, recipient, nonce }

			const timestamp = Date.parse(issuedAt)
			const topic = urlParams.get("topic")
			assert(topic !== null, `topic is null`)
			;(async () => {
				console.log("setting up wallet selector")
				const selector = await setupWalletSelector({
					network: network,
					modules: [setupMyNearWallet()],
				})

				console.log("getting wallet")
				const wallet = await selector.wallet()

				console.log("creating session signer")
				const sessionSigner = new NEARSigner({ network, wallet, store: sessionStore, recipient: message.recipient })
				console.log("saving session")
				await sessionSigner.saveSession(message, signature, publicKey, { timestamp, topic })
				console.log("setting address")
				setAddress(`near:${network}:${walletAddress}`)
				setSessionSigner(sessionSigner)
			})()
		}
	}, [])

	const connect = useCallback(async () => {
		const selector = await setupWalletSelector({
			network: network,
			modules: [setupMyNearWallet()],
		})

		const modal = setupModal(selector, {
			contractId: "bob-canvas.near",
		})
		modal.show()

		const wallet = await selector.wallet()
		const accounts = await wallet.getAccounts()
		const walletAddress = accounts[0].accountId

		const signer = new NEARSigner({ network, wallet, store: sessionStore, recipient })

		setAddress(walletAddress)
		setSessionSigner(signer)
	}, [])

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
	} else if (address !== null /*&& sessionSigner instanceof SubstrateSigner */) {
		return (
			<div className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200">
				<button onClick={() => disconnect()}>Disconnect NEAR wallet</button>
			</div>
		)
	} else if (address === null) {
		const buttonEnabledClassName = `p-2 block w-full border-t hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200`
		const buttonDisabledClassName = `p-2 block w-full border-t bg-gray-100 text-gray-600`
		const disabled = false // handle === ""
		return (
			<div className="border rounded">
				<div className="p-2 border-b">Connect NEAR</div>
				{/* <form className="p-2 flex flex-col items-stretch">
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
				</form> */}
				<button
					className={disabled ? buttonDisabledClassName : buttonEnabledClassName}
					disabled={disabled}
					onClick={(e) => {
						e.preventDefault()
						connect()
					}}
				>
					Log in
				</button>
			</div>
		)
	} else {
		return (
			<div className="p-2 border rounded bg-gray-100 text-gray-600">
				<button disabled>Connect NEAR wallet</button>
			</div>
		)
	}
}
