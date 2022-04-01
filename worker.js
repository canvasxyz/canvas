import path from "node:path"
import assert from "node:assert"
import { MessagePort, parentPort } from "node:worker_threads"

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
 * type Model = { set: (key: string, params: {}) => void; delete: (key: string) => void	}
 *
 * Actions should be verified *before* being sent to the worker.
 *
 * VIEW STATE --------------
 * Calls to .set and .delete get forwarded on modelPort as { id, name, key, value } messages.
 * For .set(key, params), value is the params object, and for .delete, value is null.
 */

parentPort.once("message", async ({ multihash, actionPort, modelPort }) => {
	assert(typeof multihash === "string")
	assert(actionPort instanceof MessagePort)
	assert(modelPort instanceof MessagePort)

	const appPath = path.resolve(appDirectory, multihash)
	const specPath = path.resolve(appPath, "spec.js")
	const { actions, models, routes } = await import(specPath)

	actionPort.on("message", async ({ id, action }) => {
		const { from, call, args, timestamp } = action

		const db = {}
		for (const name of Object.keys(models)) {
			db[name] = {
				set(key, params) {
					modelPort.postMessage({ timestamp, key, name, value: params })
				},
				delete(key) {
					modelPort.postMessage({ timestamp, key, name, value: null })
				},
			}
		}

		const context = { db, from, timestamp }

		try {
			assert(call in actions, `Invalid action name ${JSON.stringify(call)}`)
			await actions[call].apply(context, args)
			console.log("success! posting result to main")
			actionPort.postMessage({ id, status: "success" })
		} catch (err) {
			console.log("failure! posting error to main", typeof err, err.toString())
			actionPort.postMessage({
				id,
				status: "failure",
				error: err.toString(),
			})
		}
	})

	const actionParameters = {}
	for (const [call, handler] of Object.entries(actions)) {
		assert(typeof handler === "function")
		actionParameters[call] = parseHandlerParameters(handler)
	}

	parentPort.postMessage({ models, routes, actionParameters })
})

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
