import React, { createContext, useState, useEffect, useCallback, useMemo, useContext, useRef } from "react"

import { ethers } from "ethers"
import { useDebouncedCallback } from "use-debounce"

import type { Action, ActionArgument, ActionPayload, ModelValue } from "@canvas-js/core"
import { getActionSignatureData } from "@canvas-js/core/lib/signers.js"

declare global {
	var ethereum: ethers.providers.Provider & ethers.providers.ExternalProvider
}

interface CanvasContextValue {
	host?: string
	refreshInterval: number
	multihash: string | null
	currentAddress: string | null
	currentSigner: ethers.providers.JsonRpcSigner | null
	dispatch: (call: string, args: ActionArgument[]) => Promise<void>
	connect: () => void
	loading: boolean
	provider: ethers.providers.Provider | null
}

const defaultRefreshInterval = 3000

const CanvasContext = createContext<CanvasContextValue>({
	refreshInterval: defaultRefreshInterval,
	multihash: null,
	currentAddress: null,
	currentSigner: null,
	dispatch: (call, args) => Promise.reject(),
	connect: () => {},
	loading: true,
	provider: null,
})

interface CanvasProps {
	host: string
	refreshInterval?: number
}

export const Canvas: React.FC<CanvasProps> = (props) => {
	const refreshInterval = useMemo(() => props.refreshInterval ?? defaultRefreshInterval, [])

	const [currentSigner, setCurrentSigner] = useState<ethers.providers.JsonRpcSigner | null>(null)
	const [currentAddress, setCurrentAddress] = useState<string | null>(null)
	const [multihash, setMultihash] = useState<string | null>(null)

	const dispatch = useCallback(
		async (call: string, args: ActionArgument[]) => {
			if (currentSigner === null || currentAddress === null) {
				throw new Error("no signer connected")
			} else if (multihash === null) {
				throw new Error("not connected to a spec")
			}

			const timestamp = Math.round(Date.now() / 1000)
			const payload: ActionPayload = {
				from: currentAddress,
				spec: multihash,
				call: call,
				args: args,
				timestamp: timestamp,
			}

			const signatureData = getActionSignatureData(payload)
			const signature = await currentSigner._signTypedData(...signatureData)
			const action: Action = { signature, session: null, payload }
			const res = await fetch(`${props.host}/actions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(action),
			})

			if (!res.ok) {
				const err = await res.text()
				throw new Error(err)
			}
		},
		[currentSigner, currentAddress, multihash]
	)

	const [loading, setLoading] = useState<boolean>(true)
	const [accounts, setAccounts] = useState<string[]>([])
	const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null)

	useEffect(() => {
		if (window.ethereum === undefined) {
			setLoading(false)
			return
		}

		const provider = new ethers.providers.Web3Provider(window.ethereum)
		setProvider(provider)

		async function handleConnect() {
			const accounts = await provider.send("eth_accounts", [])
			setAccounts(accounts)
			setLoading(false)

			if (accounts.length > 0) {
				const [address] = accounts
				const signer = provider.getSigner(address)
				setCurrentAddress(address)
				setCurrentSigner(signer)
			}
		}

		window.ethereum.on("connect", handleConnect)

		function handleAccountsChanged(accounts: string[]) {
			setAccounts(accounts)
			if (accounts.length > 0) {
				const [address] = accounts
				const signer = provider.getSigner(address)
				setCurrentAddress(address)
				setCurrentSigner(signer)
			} else {
				setCurrentAddress(null)
				setCurrentSigner(null)
			}
		}

		window.ethereum.on("accountsChanged", handleAccountsChanged)

		return () => {
			window.ethereum.removeListener("connect", handleConnect)
			window.ethereum.removeListener("accountsChanged", handleAccountsChanged)
		}
	}, [])

	const connect = useCallback(() => {
		if (provider !== null && accounts.length === 0) {
			provider.send("eth_requestAccounts", [])
		}
	}, [accounts, provider])

	useEffect(() => {
		const eTagPattern = /^"([a-zA-Z0-9]+)"$/
		fetch(props.host, { method: "HEAD" })
			.then((res) => {
				const etag = res.headers.get("ETag")
				if (res.ok && etag !== null && eTagPattern.test(etag)) {
					const [_, multihash] = eTagPattern.exec(etag)!
					setMultihash(multihash)
				}
			})
			.catch((err) => {
				console.error(err)
			})
	}, [])

	return (
		<CanvasContext.Provider
			value={{
				host: props.host,
				refreshInterval,
				currentAddress,
				currentSigner,
				dispatch,
				multihash,
				connect,
				loading,
				provider,
			}}
		>
			{props.children}
		</CanvasContext.Provider>
	)
}

export function useCanvas(): {
	multihash: string | null
	currentAddress: string | null
	dispatch: (call: string, args: ActionArgument[]) => Promise<void>
	connect: () => void
	provider: ethers.providers.Provider | null
} {
	const { multihash, currentAddress, dispatch, connect, provider } = useContext(CanvasContext)
	return { multihash, currentAddress, dispatch, connect, provider }
}

const routePattern = /^(\/:?[a-zA-Z0-9_]+)+$/
function getRouteURL(host: string, route: string, params: Record<string, string>): string {
	if (!routePattern.test(route)) {
		throw new Error("invalid route")
	}

	const components = route.slice(1).split("/")
	const componentValues = components.map((component) => {
		if (component.startsWith(":")) {
			const param = params[component.slice(1)]
			if (typeof param !== "string") {
				throw new Error(`missing param ${component}`)
			}

			return encodeURIComponent(param)
		} else {
			return component
		}
	})

	return `${host}/${componentValues.join("/")}`
}

export function useRoute<T extends Record<string, ModelValue> = Record<string, ModelValue>>(
	route: string,
	params: Record<string, string> = {}
): [null | Error, null | T[]] {
	const { host } = useContext(CanvasContext)
	if (host === undefined) {
		throw new Error("no host provided! you must provide a host URL in a parent Canvas element")
	}

	const [error, setError] = useState<Error | null>(null)
	const [result, setResult] = useState<T[] | null>(null)

	const urlRef = useRef<string | null>(null)
	const refresh = useDebouncedCallback(
		async () => {
			if (urlRef.current !== null) {
				const res = await fetch(urlRef.current, { headers: { accept: "application/json" } })
				if (res.ok) {
					const data = await res.json()
					setResult(data)
					setError(null)
				} else {
					const text = await res.text()
					setError(new Error(`Failed to fetch route: ${text}`))
				}
			}
		},
		3000,
		{ leading: true }
	)

	useEffect(() => {
		const url = getRouteURL(host, route, params)
		if (url !== urlRef.current) {
			urlRef.current = url
			refresh()
		}
	}, [route, params])

	useEffect(() => {
		const interval = setInterval(() => refresh(), 5000)
		return () => clearInterval(interval)
	}, [])

	return [error, result]
}
