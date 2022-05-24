import Hash from "ipfs-only-hash"
import { ethers } from "ethers"
import { recoverTypedSignature, SignTypedDataVersion } from "@metamask/eth-sig-util"
import { BrowserCore, objectSpecToString, getActionSignaturePayload, getSessionSignaturePayload } from "@canvas-js/core"
import { useEffect, useState } from "react"
import randomAccessIDB from "random-access-idb"

const LOCALSTORAGE_KEY = "__CANVAS_SESSION"

export default function useCanvas({ spec, specServer, subscriptions }) {
	const [core, setCore] = useState()
	const [idb, setIDB] = useState()

	useEffect(() => {
		console.log("Starting Canvas!")
		const fetchSpec = async () => {
			// default to using a spec provided to the hook
			if (spec !== undefined) {
				return spec
			}
			// otherwise, fetch the spec from specServer
			if (specServer !== undefined) {
				const response = await fetch(specServer)
				const json = await response.json()

				console.log(`Downloading spec from ${specServer}`)
				console.log(`Downloaded spec: data:text/plain;charset=utf-8,${encodeURIComponent(json.spec)}`)

				return json.spec
			}
			throw new Error("useCanvas: must provide spec or specServer")
		}

		// fetch and start up the spec
		fetchSpec()
			.catch(console.error)
			.then((spec) => {
				Hash.of(typeof spec === "string" ? spec : objectSpecToString(spec)).then((hash) => {
					const idb = randomAccessIDB(hash)
					setIDB(idb)
					BrowserCore.initialize({
						spec,
						sqlJsOptions: { locateFile: (file) => `/public/${file}` },
						storage: idb,
						replay: true,
					}).then((core) => {
						console.log("Initialized Canvas core")
						setCore(core)
						subscriptions.forEach((route) => {
							updateView(route, core)
							console.log(`Initialized view: ${route}`)
						})
					})
				})
			})
	}, [spec, specServer])

	const [currentSigner, setCurrentSigner] = useState()
	const [currentAddress, setCurrentAddress] = useState()
	const [currentSessionSigner, setCurrentSessionSigner] = useState()
	useEffect(() => {
		// get a web3 provider
		let provider
		try {
			provider = new ethers.providers.Web3Provider(window.ethereum)
		} catch (err) {
			// TODO handle error: Missing provider
			return
		}
		if (!provider) {
			return
		}

		// get current accounts
		provider
			.send("eth_requestAccounts", [])
			.then(() => {
				// save the signer
				const signer = provider.getSigner()
				setCurrentSigner(signer)
				signer.getAddress().then((address) => {
					setCurrentAddress(address)

					// load any saved session
					try {
						const data = localStorage.getItem(LOCALSTORAGE_KEY)
						const sessionObject = JSON.parse(data)
						const sessionSigner = new ethers.Wallet(sessionObject.privateKey)
						if (sessionObject.from !== address) return
						setCurrentSessionSigner(sessionSigner)
					} catch (err) {}
				})
			})
			.catch(() => {
				// TODO handle error: Wallet did not return an address
			})

		// watch for changes
		provider.provider
			.on("accountsChanged", (accounts) => {
				// clear any current session, then fetch the new "current address" of the wallet
				console.log("accounts changed, logging out current session")
				setCurrentSessionSigner(null)
				localStorage.setItem(LOCALSTORAGE_KEY, null)

				const signer = provider.getSigner()
				setCurrentSigner(signer)
				signer.getAddress().then((address) => {
					setCurrentAddress(address)
				})
			})
			.on("chainChanged", (accounts) => {
				console.log("chain changed", accounts)
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
			const sessionDuration = 86400
			const sessionSigner = ethers.Wallet.createRandom()
			const sessionObject = {
				from: currentAddress,
				privateKey: sessionSigner.privateKey,
				expiration: timestamp + sessionDuration,
			}

			const payload = {
				from: currentAddress,
				spec: core.multihash,
				timestamp,
				session_public_key: sessionSigner.address,
				session_duration: sessionDuration,
			}
			const payloadString = JSON.stringify(payload)

			const [domain, types, value] = getSessionSignaturePayload(
				currentAddress,
				core.multihash,
				timestamp,
				sessionSigner.address,
				sessionDuration
			)

			currentSigner._signTypedData(domain, types, value).then((signature) => {
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

			const [domain, types, value] = getActionSignaturePayload(
				currentAddress,
				core.multihash,
				Math.round(+new Date() / 1000),
				call,
				args
			)
			;(currentSessionSigner || currentSigner)._signTypedData(domain, types, value).then((signature) => {
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
