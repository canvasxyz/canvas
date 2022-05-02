import Hash from "ipfs-only-hash"
import { ethers } from "ethers"
import { BrowserCore, objectSpecToString } from "canvas-core"
import { useEffect, useState } from "react"
import randomAccessIDB from "random-access-idb"

export default function useCore(spec, { subscriptions }) {
	const [core, setCore] = useState()
	const [idb, setIDB] = useState()
	useEffect(() => {
		Hash.of(typeof spec === "string" ? spec : objectSpecToString(spec)).then((hash) => {
			const idb = randomAccessIDB(hash)
			setIDB(idb)
			BrowserCore.initialize({
				spec,
				sqlJsOptions: { locateFile: (file) => `/public/${file}` },
				storage: idb,
				replay: true,
			}).then((core) => {
				setCore(core)
				subscriptions.forEach((route) => updateView(route, core))
			})
		})
	}, [spec])

	const [currentSigner, setCurrentSigner] = useState()
	const [currentAddress, setCurrentAddress] = useState()
	useEffect(() => {
		const provider = new ethers.providers.Web3Provider(window.ethereum)
		if (!provider) {
			// TODO handle error: Missing provider
			return
		}
		provider
			.send("eth_requestAccounts", [])
			.then(() => {
				const signer = provider.getSigner()
				setCurrentSigner(signer)
				signer.getAddress().then((address) => {
					setCurrentAddress(address)
				})
			})
			.catch(() => {
				// TODO handle error: Wallet did not return an address
			})
	}, [])

	const signAndSendAction = async (call, ...args) => {
		return new Promise((resolve, reject) => {
			if (!core) reject(new Error("Core not initialized yet"))

			const payload = {
				from: currentAddress,
				spec: core.multihash,
				timestamp: Math.round(+new Date() / 1000),
				call,
				args,
			}
			const payloadString = JSON.stringify(payload)
			currentSigner.signMessage(payloadString).then((signature) => {
				const action = {
					from: currentAddress,
					session: null,
					signature,
					payload: payloadString,
				}
				core
					.apply(action)
					.then((result) => {
						// TODO: have the core return which models updated, and only refresh related routes
						subscriptions.forEach((route) => updateView(route, core))
						resolve(result)
					})
					.catch((error) => reject(error))
			})
		})
	}
	// TODO: signSession

	const [cache, setCache] = useState({})
	const views = {
		get(path) {
			return cache[path]
		},
	}
	const updateView = (route, core) => {
		const newCache = { ...cache }
		newCache[route] = core.getRoute(route, {})
		setCache(newCache)
	}

	return [views, signAndSendAction, core]
}
