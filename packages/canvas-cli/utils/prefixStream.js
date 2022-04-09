export async function* createPrefixStream(db, prefix) {
	const deletedKeys = new Set()
	for await (const entry of db.createHistoryStream({ reverse: true })) {
		if (entry.key.startsWith(prefix)) {
			if (entry.type === "del") {
				deletedKeys.add(entry.key)
			} else if (entry.type === "put") {
				if (deletedKeys.has(entry.key)) {
					continue
				} else {
					yield [entry.key, entry.value]
				}
			}
		}
	}
}
