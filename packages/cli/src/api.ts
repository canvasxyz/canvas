import { StatusCodes } from "http-status-codes"
import type { Request, Response } from "express"

import chalk from "chalk"

import type { ModelValue } from "@canvas-js/interfaces"
import { actionType, Core, sessionType } from "@canvas-js/core"

export async function handleSession(core: Core, req: Request, res: Response) {
	const session = req.body
	if (!sessionType.is(session)) {
		console.error(chalk.red(`[canvas-cli] Received invalid session`))
		res.status(StatusCodes.BAD_REQUEST).end()
		return
	}

	await core
		.applySession(session)
		.then(({ hash }) => res.json({ hash }))
		.catch((err) => {
			const message = err instanceof Error ? err.message : err.toString()
			console.log(chalk.red(`[canvas-cli] Failed to create session: ${message}`))
			res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(message)
		})
}

export async function handleAction(core: Core, req: Request, res: Response) {
	const action = req.body
	if (!actionType.is(action)) {
		console.log(chalk.red(`[canvas-cli] Received invalid action`))
		res.status(StatusCodes.BAD_REQUEST).end()
		return
	}

	await core
		.applyAction(action)
		.then(({ hash }) => res.json({ hash }))
		.catch((err) => {
			const message = err instanceof Error ? err.message : err.toString()
			console.log(chalk.red(`[canvas-cli] Failed to apply action: ${message}`))
			res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(message)
		})
}

export async function handleRoute(core: Core, pathComponents: string[], req: Request, res: Response) {
	if (pathComponents.length === 0) {
		const { component, routeParameters, actionParameters } = core.vm
		const actions = Object.keys(actionParameters)
		const routes = Object.keys(routeParameters)
		return res.json({ uri: core.uri, cid: core.cid.toString(), component, actions, routes })
	}

	const [route, params] = matchRoute(core, pathComponents)
	if (route === null || params === null) {
		return res.status(StatusCodes.BAD_REQUEST).end()
	}

	for (const [key, value] of Object.entries(req.query)) {
		if (key in params) {
			continue
		} else if (typeof value === "string") {
			try {
				params[key] = JSON.parse(value)
			} catch (err) {
				return res.status(StatusCodes.BAD_REQUEST).end(`Invalid query param: ${key}=${value}`)
			}
		}
	}

	if (req.headers.accept === "text/event-stream") {
		// subscription response
		res.setHeader("Cache-Control", "no-cache")
		res.setHeader("Content-Type", "text/event-stream")
		res.setHeader("Connection", "keep-alive")
		res.flushHeaders()

		let data: Record<string, ModelValue>[] | null = null
		const listener = async () => {
			const newData = core.getRoute(route, params)
			if (data === null || !compareResults(data, newData)) {
				data = newData
				res.write(`data: ${JSON.stringify(data)}\n\n`)
			}
		}

		try {
			await listener()
		} catch (err) {
			// kill the EventSource if this.core.getRoute() fails on first request
			// TODO: is it possible that it succeeds now, but fails later with new `values`?
			console.error(chalk.red("[canvas-cli] error fetching view"), err)
			console.error(err)
			res.status(StatusCodes.BAD_REQUEST)
			res.end(`Route error: ${err}`)
			return
		}

		core.addEventListener("action", listener)
		res.on("close", () => core.removeEventListener("action", listener))
	} else {
		// normal JSON response
		let data = undefined
		try {
			data = core.getRoute(route, params)
		} catch (err) {
			res.status(StatusCodes.BAD_REQUEST)
			return err instanceof Error ? res.end(`Route error: ${err.message}`) : res.end()
		}

		return res.status(StatusCodes.OK).json(data)
	}
}

function parseParams(route: string, pathComponents: string[]): Record<string, ModelValue> | null {
	const routeComponents = route.slice(1).split("/")
	if (routeComponents.length !== pathComponents.length) {
		return null
	}

	const params: Record<string, ModelValue> = {}
	for (const [i, routeComponent] of routeComponents.entries()) {
		const pathComponent = pathComponents[i]
		if (routeComponent.startsWith(":")) {
			params[routeComponent.slice(1)] = pathComponent
		} else if (pathComponent !== routeComponent) {
			return null
		}
	}

	return params
}

function matchRoute(core: Core, pathComponents: string[]): [string | null, Record<string, ModelValue> | null] {
	for (const route in core.vm.routes) {
		const params = parseParams(route, pathComponents)
		if (params !== null) {
			return [route, params]
		}
	}

	return [null, null]
}

function compareResults(a: Record<string, ModelValue>[], b: Record<string, ModelValue>[]) {
	if (a.length !== b.length) {
		return false
	}

	for (let i = 0; i < a.length; i++) {
		for (const key in a[i]) {
			if (a[i][key] !== b[i][key]) {
				return false
			}
		}

		for (const key in b[i]) {
			if (b[i][key] !== a[i][key]) {
				return false
			}
		}
	}
}
