import { useState, useEffect } from "react"
import { ethers } from "ethers"

export const usePrivkey = (storageId: string) => {
	const [privkey, setPrivkey] = useState<string>()
	useEffect(() => {
		let wallet
		const privkey = localStorage.getItem(storageId)
		if (privkey) {
			try {
				wallet = new ethers.Wallet(privkey)
			} catch (err) {
				wallet = ethers.Wallet.createRandom()
			}
		} else {
			wallet = ethers.Wallet.createRandom()
		}
		localStorage.setItem(storageId, wallet.privateKey)
		setPrivkey(wallet.privateKey)
	}, [storageId])

	return privkey
}
