#!/usr/bin/env node

import http from "node:http"
import path from "node:path"
import fs from "node:fs"

import stoppable from "stoppable"
import chalk from "chalk"
import next from "next"
import express from "express"
import bodyParser from "body-parser"
import { StatusCodes } from "http-status-codes"

import { constants, Core } from "@canvas-js/core"
import { handleAction, handleRoute, handleSession } from "./api.js"

const directory = process.env.CANVAS_PATH ?? null
const specPath = path.resolve(directory ?? ".", constants.SPEC_FILENAME)
const spec = fs.readFileSync(specPath, "utf-8")

// TODO: set up providers and block cache
// TODO: set up peerId and libp2p node
global.core = await Core.initialize({ directory, spec, unchecked: true, offline: true })

const port = Number(process.env.PORT) || 3000
const hostname = "localhost"
const nextApp = next({ dev: process.env.NODE_ENV !== "production", hostname, port })
await nextApp.prepare()
const nextAppHandler = nextApp.getRequestHandler()

const prefix = `/app/${core.cid.toString()}`

const canvasRouteHandler = express()
canvasRouteHandler.use(bodyParser.json())
canvasRouteHandler.get("/app/:name/*", (req, res) => {
	const { name } = req.params
	if (name !== core.cid.toString()) {
		return res.status(StatusCodes.NOT_FOUND).end()
	}

	const path = req.path.slice(prefix.length)
	const pathComponents = path === "" || path === "/" ? [] : path.slice(1).split("/")

	handleRoute(core, pathComponents, req, res)
})

canvasRouteHandler.post("/app/:name/sessions", (req, res) => {
	const { name } = req.params
	if (name !== core.cid.toString()) {
		return res.status(StatusCodes.NOT_FOUND).end()
	}

	handleSession(core, req, res)
})

canvasRouteHandler.post("/app/:name/actions", (req, res) => {
	const { name } = req.params
	if (name !== core.cid.toString()) {
		return res.status(StatusCodes.NOT_FOUND).end()
	}

	handleAction(core, req, res)
})

const server = stoppable(
	http.createServer((req, res) => {
		if (typeof req.url === "string" && req.url.startsWith(prefix)) {
			canvasRouteHandler(req, res)
		} else {
			nextAppHandler(req, res)
		}
	}),
	0
)

server.listen(port, () => console.log(`> Ready on http://${hostname}:${port}`))

let stopping: boolean = false
process.on("SIGINT", () => {
	if (stopping) {
		process.exit(1)
	} else {
		stopping = true
		process.stdout.write(
			`\n${chalk.yellow("Received SIGINT, attempting to exit gracefully. ^C again to force quit.")}\n`
		)

		nextApp.close().then(() => {
			server.stop()
			global.core.close()
		})
	}
})
