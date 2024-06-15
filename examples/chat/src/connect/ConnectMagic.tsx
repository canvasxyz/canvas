import { BrowserProvider } from "ethers"
import React, { useCallback, useContext, useEffect, useState } from "react"
import { AuthExtension } from "@magic-ext/auth"
import { Magic as MagicBase, RPCError, RPCErrorCode } from "magic-sdk"

import { SIWESigner } from "@canvas-js/chain-ethereum"

import { AppContext } from "../AppContext.js"

type ConnectMagicProps = {
	publicMagicApiKey: string
	rpcUrl: string
	chainId: number
}

export const ConnectMagic = ({ publicMagicApiKey, rpcUrl, chainId }: ConnectMagicProps) => {
	const { app, sessionSigner, setSessionSigner, address, setAddress } = useContext(AppContext)
	const [magic, setMagic] = useState<MagicBase<[AuthExtension]> | null>(null)
	const [email, setEmail] = useState("")
	const [error, setError] = useState<Error | null>(null)
	const [loginInProgress, setLoginInProgress] = useState(false)

	useEffect(() => {
		const magic = new MagicBase(publicMagicApiKey, {
			network: {
				rpcUrl,
				chainId,
			},
			extensions: [new AuthExtension()],
		})

		setMagic(magic)
	}, [])

	const connect = useCallback(async () => {
		if (!email.match(/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/)) {
			setError(new Error(`email '${email}' is invalid`))
		} else {
			try {
				setLoginInProgress(true)
				setError(null)
				const account = await magic?.auth.loginWithEmailOTP({ email })
				if (account) {
					console.log(`account: ${JSON.stringify(account)}`)

					if (magic) {
						const provider = new BrowserProvider(magic.rpcProvider)
						const signer = await provider.getSigner()
						const network = await provider.getNetwork()
						const sessionSigner = new SIWESigner({ signer, chainId: Number(network.chainId) })
						const {
							payload: { did },
						} = await sessionSigner.newSession(app!.topic)
						const address = did
						setAddress(address)
						setSessionSigner(sessionSigner)
					}

					setEmail("")
				}
			} catch (e) {
				console.log("login error: " + JSON.stringify(e))
				if (e instanceof RPCError) {
					switch (e.code) {
						case RPCErrorCode.MagicLinkFailedVerification:
						case RPCErrorCode.MagicLinkExpired:
						case RPCErrorCode.MagicLinkRateLimited:
						case RPCErrorCode.UserAlreadyLoggedIn:
							setError(new Error(e.message))
							break
						default:
							setError(new Error("Something went wrong. Please try again."))
					}
				}
			} finally {
				setLoginInProgress(false)
			}
		}
	}, [email, magic])
	const disconnect = useCallback(async () => {
		setAddress(null)
		setSessionSigner(null)
	}, [])

	if (error !== null) {
		return (
			<div className="p-2 border rounded bg-red-100 text-sm">
				<code>{error.message}</code>
			</div>
		)
	} else if (magic === null) {
		return (
			<div className="p-2 border rounded bg-gray-200">
				<button disabled>Loading...</button>
			</div>
		)
	} else if (loginInProgress) {
		return (
			<div className="p-2 border rounded bg-gray-200">
				<button disabled>Logging in...</button>
			</div>
		)
	} else if (address !== null && sessionSigner instanceof SIWESigner) {
		return (
			<button
				onClick={() => disconnect()}
				className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200"
			>
				Disconnect Magic
			</button>
		)
	} else {
		return (
			<div className="border rounded">
				<form
					className="flex flex-col items-stretch gap-2"
					onSubmit={async (e) => {
						e.preventDefault()
						await connect()
					}}
				>
					<div className="p-2 flex flex-col items-stretch">
						<label className="block" htmlFor="bsky-identifier">
							Email address
						</label>
						<input
							className="px-1 block border rounded-sm"
							id="bsky-identifier"
							type="text"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
						/>
					</div>
					<button
						className="p-2 block w-full border-t hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200"
						type="submit"
					>
						Log in
					</button>
				</form>
			</div>
		)
	}
}
