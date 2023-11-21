import { Magic, Magic as MagicBase, RPCError, RPCErrorCode } from "magic-sdk"
import { AuthExtension } from "@magic-ext/auth"
import { CosmosExtension } from "@magic-ext/cosmos"
import React, { useCallback, useContext, useEffect, useState } from "react"

import { CosmosSigner } from "@canvas-js/chain-cosmos"

import { AppContext } from "../AppContext.js"

type ConnectMagicProps = {
	publicMagicApiKey: string
	rpcUrl: string
}

// this is in a function so that we can use ReturnType
function createMagic(publicMagicApiKey: string, cosmosRpcUrl: string) {
	return new Magic(publicMagicApiKey, {
		extensions: [
			new CosmosExtension({
				rpcUrl: cosmosRpcUrl
			}),
			new AuthExtension()
		]
	})
}

export const ConnectMagicCosmos = ({ publicMagicApiKey, rpcUrl }: ConnectMagicProps) => {
	const { app, sessionSigner, setSessionSigner, address, setAddress } = useContext(AppContext)
	const [magic, setMagic] = useState<ReturnType<typeof createMagic> | null>(null)
	const [email, setEmail] = useState("")
	const [error, setError] = useState<Error | null>(null)
	const [loginInProgress, setLoginInProgress] = useState(false)

	useEffect(() => {
		setMagic(createMagic(publicMagicApiKey, rpcUrl))
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
						console.log(magic.cosmos)
						// magic.cosmos.sign
						// const provider = new BrowserProvider(magic.rpcProvider)
						// const signer = await provider.getSigner()
						// const network = await provider.getNetwork()
						// const sessionSigner = new CosmosSigner({ signer })
						// const sessionSigner = new SIWESigner({ signer, chainId: Number(network.chainId) })
						// const { address } = await sessionSigner.getSession(app!.topic)
						const address = "hello"
						setAddress(address)
						setSessionSigner(sessionSigner)
					} else {
						console.log("magic is null")
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
	} else if (address !== null && sessionSigner instanceof CosmosSigner) {
		return (
			<button
				onClick={() => disconnect()}
				className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200"
			>
				Disconnect Magic (Cosmos)
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
