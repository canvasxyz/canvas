import express, { Express } from "express"
import { StatusCodes } from "http-status-codes"
import { Libp2p } from "libp2p"
import client from "prom-client"

import { ServiceMap } from "./libp2p.js"

export function createAPI(libp2p: Libp2p<ServiceMap>): Express {
	const app = express()

	app.get("/", (req, res) => {
		return void res.writeHead(StatusCodes.OK).end()
	})

	app.get("/metrics", async (req, res) => {
		try {
			const result = await client.register.metrics()
			return void res.writeHead(StatusCodes.OK, { "content-type": client.register.contentType }).end(result)
		} catch (err: any) {
			console.error(err)
			return void res.writeHead(StatusCodes.INTERNAL_SERVER_ERROR).end()
		}
	})

	return app
}
