import process from "node:process"
import path from "node:path"
import fs from "node:fs"

import * as esbuild from "esbuild"
import puppeteer from "puppeteer"
import express from "express"
import dotenv from "dotenv"

import { Canvas } from "@canvas-js/core"

const cacheDirectory = path.resolve(".cache")
if (fs.existsSync(cacheDirectory)) {
	console.log(`Removing old cache directory at ${cacheDirectory}`)
	fs.rmSync(cacheDirectory, { recursive: true })
}

console.log(`Creating cache directory at ${cacheDirectory}`)
fs.mkdirSync(cacheDirectory)

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

	console.log("Compiled client bundle", result.outputFiles)
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

const bootstrapList: string[] = []

{
	// Step 3: start a replication server
	const serverPath = path.resolve(cacheDirectory, "server")
	fs.mkdirSync(serverPath)

	const app = await Canvas.initialize({
		path: serverPath,
		contract: fs.readFileSync("assets/contract.canvas.js", "utf-8"),
		listen: [`/ip4/127.0.0.1/tcp/8080/ws`],
	})

	app.addEventListener("message", ({ detail: { id, message } }) =>
		console.log("[server]   [log] message", id, message.payload.type),
	)

	bootstrapList.push(`/ip4/127.0.0.1/tcp/8080/ws/p2p/${app.peerId.toString()}`)
	console.log("Replication server listening on", bootstrapList)
}

// Step 4: launch a browser client
for (let i = 0; i < 2; i++) {
	const userDataDir = path.resolve(cacheDirectory, `client-${i}`)
	fs.mkdirSync(userDataDir)

	const browser = await puppeteer.launch({
		headless: "new",
		args: ["--enable-automation"],
		userDataDir,
	})

	const page = await browser.newPage()

	page.on("console", (msg) => {
		const type = msg.type()
		Promise.all(msg.args().map((arg) => arg.jsonValue())).then(([format, ...args]) =>
			console.log(`[client-${i}] [${type}] ${format}`, ...args),
		)
	})

	await page.evaluateOnNewDocument(`
        // localStorage.setItem("debug", "canvas:*,libp2p:gossipsub*");
        localStorage.setItem("bootstrapList", JSON.stringify(${JSON.stringify(bootstrapList)}));
    `)

	await page.goto("http://localhost:3000/")
}
