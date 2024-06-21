import express from "express"
import { StatusCodes } from "http-status-codes"
import client from "prom-client"

export const app = express()

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
