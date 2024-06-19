import { nanoid } from "nanoid"
import { randomUUID } from "node:crypto"

import { GossipLogConsumer } from "@canvas-js/gossiplog"
import { testPlatforms } from "./utils.js"

const apply: GossipLogConsumer<string> = ({}) => {}

testPlatforms("get children (append, linear history)", async (t, openGossipLog) => {
	const topic = randomUUID()
	const log = await openGossipLog(t, { topic, apply, indexAncestors: true })

	const n = 20
	const ids: string[] = []
	for (let i = 0; i < n; i++) {
		const { id } = await log.append(nanoid())
		ids.push(id)
	}

	for (let i = 1; i < n; i++) {
		t.deepEqual(await log.getChildren(ids[i - 1]), [ids[i]], `i=${i}`)
	}
})
