import process from "node:process"
import fs from "node:fs"

import * as esbuild from "esbuild"
import puppeteer from "puppeteer"
import express from "express"
import dotenv from "dotenv"
import { createFromProtobuf } from "@libp2p/peer-id-factory"

import debug from "debug"
import { Canvas } from "@canvas-js/core"

dotenv.config()

{
	// Step 1: compile the client bundle

	const result = await esbuild.build({
		format: "esm",
		entryPoints: ["src/client/index.ts"],
		bundle: true,
		outdir: "dist",
		platform: "browser",
		external: ["fs", "path"],
	})

	for (const error of result.errors) {
		console.error("[esbuild] [error]", error)
	}

	for (const warning of result.warnings) {
		console.warn("[esbuild] [warning]", warning)
	}

	if (result.errors.length > 0) {
		throw new Error("compilation failed")
	}
}

const port = 3000

{
	// Step 2: start an HTTP server
	const app = express()
	app.use("/", express.static("assets"))
	app.use("/dist", express.static("dist"))
	await new Promise<void>((resolve) => {
		const server = app.listen(port, () => {
			console.log(`HTTP server listening on http://localhost:${port}`)
			resolve()
		})

		process.on("SIGINT", () => server.close())
	})
}

// // Step 3: start a bootstrap server
// await import("@canvas-js/bootstrap-peer")

// Step 3: start a replication server
const app = await Canvas.initialize({
	contract: fs.readFileSync("assets/contract.canvas.js", "utf-8"),
	listen: [`/ip4/127.0.0.1/tcp/8080/ws`],
})

for (let i = 0; i < 30; i++) {
	// Step 4: launch a browser client
	const browser = await puppeteer.launch({ headless: "new", args: ["--enable-automation"] })

	const page = await browser.newPage()

	page.on("console", (msg) => {
		const type = msg.type()
		Promise.all(msg.args().map((arg) => arg.jsonValue())).then(([format, ...args]) =>
			console.log(`[client-${i}] [${type}] ${format}`, ...args),
		)
		// if (type === "debug") {
		// } else {
		// 	console.log(`[[client-${i}]] [${type}] ${msg.text()}`)
		// }
	})

	const bootstrapList = JSON.stringify([`/ip4/127.0.0.1/tcp/8080/ws/p2p/${app.peerId.toString()}`])

	await page.evaluateOnNewDocument(`
        // localStorage.setItem("debug", "canvas:*,libp2p:gossipsub*");
        localStorage.setItem("bootstrapList", JSON.stringify(${bootstrapList}));
    `)

	await page.goto("http://localhost:3000/")
}
