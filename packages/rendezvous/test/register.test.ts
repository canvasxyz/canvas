import test from "ava"
import { setTimeout } from "timers/promises"

import { getServer, getClient } from "./libp2p.js"

test("register", async (t) => {
	const server = await getServer(t, { port: 8880 })
	const clientA = await getClient(t, { name: "client-a", port: 8881 })
	const clientB = await getClient(t, { name: "client-b", port: 8882 })

	await setTimeout(100)

	await clientA.services.rendezvous.connect(server.getMultiaddrs(), async (point) => {
		await point.register("foobar")
	})

	await setTimeout(100)

	await clientB.services.rendezvous.connect(server.getMultiaddrs(), async (point) => {
		const results = await point.discover("foobar")
		t.true(results.length === 1)
		t.true(results[0].id.equals(clientA.peerId))
	})

	t.pass()
})
