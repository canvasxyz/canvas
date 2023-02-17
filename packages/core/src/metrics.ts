import { StatusCodes } from "http-status-codes"
import express from "express"
import { register, Counter, Gauge, Summary, Registry } from "prom-client"

export const libp2pRegister = new Registry()
export const canvasRegister = new Registry()

export async function getMetrics(req: express.Request, res: express.Response): Promise<void> {
	try {
		const libp2pMetrics = await libp2pRegister.metrics()
		const canvasMetrics = await canvasRegister.metrics()
		const defaultMetrics = await register.metrics()
		res.header("Content-Type", register.contentType)
		res.write(libp2pMetrics + "\n")
		res.write(canvasMetrics + "\n")
		res.end(defaultMetrics)
	} catch (err) {
		if (err instanceof Error) {
			res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(err.message)
		} else {
			throw err
		}
	}
}

export const metrics = {
	canvas_messages: new Counter({
		registers: [],
		name: "canvas_messages",
		help: "number of messages applied",
		labelNames: ["type", "uri"],
	}),
	canvas_sync_time: new Summary({
		registers: [],
		name: "canvas_sync_time",
		help: "p2p MST sync times",
		labelNames: ["uri", "status"],
		maxAgeSeconds: 60 * 60,
		ageBuckets: 24,
	}),
	canvas_gossipsub_subscribers: new Gauge({
		registers: [],
		name: "canvas_gossipsub_subscribers",
		help: "GossipSub topic subscribers",
		labelNames: ["uri"],
	}),
	canvas_sync_peers: new Gauge({
		registers: [],
		name: "canvas_sync_peers",
		help: "DHT application peers",
		labelNames: ["uri"],
	}),
}

for (const metric of Object.values(metrics)) {
	canvasRegister.registerMetric(metric)
}
