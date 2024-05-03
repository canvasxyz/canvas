import { bannedApps } from "./index.js"

export const updateFinishedMatches = async () => {
	const request = await fetch("http://skystrife-indexer.internal:8000")
	const json = await request.json()
	const finishedMatches = json.finishedMatches as string[]
	for (const match of finishedMatches) {
		if (!bannedApps.has(match)) {
			console.log("[replication-server] Banned " + match)
		}
		bannedApps.add(match)
	}
}
const updateFinishedMatchesTimer = setInterval(updateFinishedMatches, 60 * 1000)

export const initFinishedMatches = async () => {
	try {
		await updateFinishedMatches()
	} catch (err) {
		console.log("[replication-server] Could not update list of finished matches")
	}
}
