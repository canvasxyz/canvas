import path from "node:path"
import { parentPort } from "node:worker_threads"

import dotenv from "dotenv"
dotenv.config({ path: ".env" })

const appDirectory = process.env.APP_DIRECTORY
if (appDirectory === undefined) {
	throw new Error("Missing APP_DIRECTORY environment variable from .env")
}

/**
 * https://nodejs.org/dist/latest-v16.x/docs/api/worker_threads.html#class-worker
 * The nodejs docs recommend instantiating multiple MessagePorts for "separation
 * of concerns", and only using the main "global" port for setting them up in the
 * beginning.
 *
 * When we create a worker, the main thread sends the worker the multihash of the
 * spec along with two ports actionPort and modelPort. The worker sends back (on the
 * global port) a message { models, routes, actionParameters } that the main thread
 * uses to initialize the database, prepare route query statements, and so on.
 *
 * ACTION APPLICATION ------
 * To apply an action, the main thread sends an { id, action } message on the actionPort
 * and expects a { id, status: "success" } | { id, status: "failure"; error: string }
 * message in response. The .action value is an ActionPayload with type
 * { from: string; timestamp: number; call: string; args: ActionArgument[] }
 *
 * Action handlers are called with a Context object bound to `this`, with type
 * type Context = { from: string; timestamp: number; db: Record<string, Model> }
 * type Model = { set: (id: string, params: {}) => void; delete: (id: string) => void	}
 *
 * Actions should be verified *before* being sent to the worker.
 *
 * VIEW STATE --------------
 * Calls to .set and .delete get forwarded on modelPort as { timestamp, name, id, value } messages.
 * For .set(id, params), value is the params object, and for .delete, value is null.
 */

parentPort.once("message", (message) =>
	initialize(message)
		.then((app) => parentPort.postMessage({ status: "success", ...app }))
		.catch((err) => parentPort.postMessage({ status: "failure", error: err.toString() }))
)

async function initialize({ multihash, actionPort, modelPort }) {
	const appPath = path.resolve(appDirectory, multihash)
	const specPath = path.resolve(appPath, "spec.js")
	const { actions, models, routes } = await import(specPath)

	actionPort.on("message", ({ id, action }) =>
		apply(action)
			.then(() => actionPort.postMessage({ id, status: "success" }))
			.catch((err) => actionPort.postMessage({ id, status: "failure", error: err.toString() }))
	)

	async function apply({ from, call, args, timestamp }) {
		const db = {}
		for (const name of Object.keys(models)) {
			db[name] = {
				set(id, value) {
					modelPort.postMessage({ timestamp, name, id, value })
				},
			}
		}

		const context = { db, from, timestamp }
		const result = await actions[call].apply(context, args)
		if (result === false) {
			throw new Error("action handler returned false")
		}
	}

	const actionParameters = {}
	for (const [call, handler] of Object.entries(actions)) {
		actionParameters[call] = parseHandlerParameters(handler)
	}

	return { models, routes, actionParameters }
}

// https://stackoverflow.com/questions/1007981/how-to-get-function-parameter-names-values-dynamically
function parseHandlerParameters(handler) {
	return handler
		.toString()
		.replace(/[/][/].*$/gm, "") // strip single-line comments
		.replace(/\s+/g, "") // strip white space
		.replace(/[/][*][^/*]*[*][/]/g, "") // strip multi-line comments
		.split("){", 1)[0]
		.replace(/^[^(]*[(]/, "") // extract the parameters
		.replace(/=[^,]+/g, "") // strip any ES6 defaults
		.split(",")
		.filter(Boolean) // split & filter [""]
}
