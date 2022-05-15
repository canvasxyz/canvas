import Hash from "ipfs-only-hash"
import { ethers } from "ethers"
import { BrowserCore, objectSpecToString } from "canvas-core"
import { useEffect, useState } from "react"
import randomAccessIDB from "random-access-idb"

const LOCALSTORAGE_KEY = "__CANVAS_SESSION"

export default function useCanvas(spec, { subscriptions }) {
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
	const [currentSessionSigner, setCurrentSessionSigner] = useState()
	useEffect(() => {
		// load any saved session
		try {
			const data = localStorage.getItem(LOCALSTORAGE_KEY)
			const sessionObject = JSON.parse(data)
			const sessionSigner = new ethers.Wallet(sessionObject.privateKey)
			setCurrentSessionSigner(sessionSigner)
		} catch (err) {}

		// get a web3 provider
		const provider = new ethers.providers.Web3Provider(window.ethereum)
		if (!provider) {
			// TODO handle error: Missing provider
			return
		}
		provider
			.send("eth_requestAccounts", [])
			.then(() => {
				// save the signer
				const signer = provider.getSigner()
				setCurrentSigner(signer)
				signer.getAddress().then((address) => setCurrentAddress(address))
			})
			.catch(() => {
				// TODO handle error: Wallet did not return an address
			})
	}, [])

	// log out of session
	const logout = () => {
		setCurrentSessionSigner(null)
		localStorage.setItem(LOCALSTORAGE_KEY, null)
	}

	// log into a new session
	const login = async () => {
		return new Promise((resolve, reject) => {
			if (!core) reject(new Error("Core not initialized yet"))

			const timestamp = Math.round(+new Date() / 1000)
			const session_duration = 86400
			const sessionSigner = ethers.Wallet.createRandom()
			const sessionObject = {
				privateKey: sessionSigner.privateKey,
				expiration: timestamp + session_duration,
			}

			const payload = {
				from: currentAddress,
				spec: core.multihash,
				timestamp,
				session_public_key: sessionSigner.address,
				session_duration,
			}
			const payloadString = JSON.stringify(payload)
			currentSigner.signMessage(payloadString).then((signature) => {
				const action = {
					from: currentAddress,
					signature,
					payload: payloadString,
				}
				core
					.session(action)
					.then((result) => {
						// save session to localStorage
						localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(sessionObject))
						setCurrentSessionSigner(sessionSigner)
						resolve(result)
					})
					.catch((error) => reject(error))
			})
		})
	}

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
			;(currentSessionSigner || currentSigner).signMessage(payloadString).then((signature) => {
				const action = {
					from: currentAddress,
					session: currentSessionSigner ? currentSessionSigner.address : null,
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

	return {
		views,
		signAndSendAction,
		login,
		logout,
		address: currentAddress,
		sessionAddress: currentSessionSigner?.address,
		core,
	}
}
