import assert from "node:assert"
import { parentPort } from "node:worker_threads"

/**
 * https://nodejs.org/dist/latest-v16.x/docs/api/worker_threads.html#class-worker
 * The nodejs docs recommend instantiating multiple MessagePorts for "separation
 * of concerns", and only using the main "global" port for setting them up in the
 * beginning.
 *
 * When we create a worker, the main thread sends the worker the absolute path of the
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

async function initialize({ path, actionPort, modelPort }) {
	const { actions, models, routes } = await import(path)
	assert(actions !== undefined, "missing actions export from spec")
	assert(models !== undefined, "missing models export from spec")
	assert(routes !== undefined, "missing routes export from spec")

	// Validate models
	for (const [name, model] of Object.entries(models)) {
		assert(name.match(/^[a-zA-Z0-9_]+$/), `invalid model name: ${JSON.stringify(name)}`)
		for (const [field, type] of Object.entries(model)) {
			assert(field.match(/^[a-zA-Z0-9_]+$/), `invalid model field name: ${JSON.stringify(field)}`)
			assert(fieldTypes.has(type), `invalid model field type: ${JSON.stringify(type)}`)
		}
	}

	// Validate actions
	for (const [name, handler] of Object.entries(actions)) {
		assert(name.match(/^[a-zA-Z0-9_]+$/), `invalid model name: ${JSON.stringify(name)}`)
		assert(typeof handler === "function", "action handlers must be functions")
	}

	// Validate routes
	for (const [name, route] of Object.entries(routes)) {
		assert(name.match(/^(\/:?[a-zA-Z0-9_]+)+$/), `invalid route name: ${JSON.stringify(name)}`)
		assert(typeof route === "string", "routes must be strings")
	}

	actionPort.on("message", ({ id, action }) =>
		apply(action)
			.then(() => actionPort.postMessage({ id, status: "success" }))
			.catch((err) => actionPort.postMessage({ id, status: "failure", error: err.toString() }))
	)

	async function apply({ from, call, args, timestamp }) {
		const db = {}
		for (const [name, model] of Object.entries(models)) {
			db[name] = {
				set(id, value) {
					assert(typeof id === "string", "model IDs must be strings")

					const validatedValue = {}
					for (const [field, fieldType] of Object.entries(model)) {
						const fieldValue = value[field]
						assert(fieldValue, `missing value for field ${JSON.stringify(field)}`)
						validateType(fieldType, fieldValue)
						validatedValue[field] = fieldValue
					}

					modelPort.postMessage({ timestamp, name, id, value: validatedValue })
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

const fieldTypes = new Set(["boolean", "string", "integer", "float", "bytes", "datetime"])

function validateType(type, value) {
	if (type === "boolean") {
		assert(value === null || typeof value === "boolean", "boolean values must be booleans")
	} else if (type === "string") {
		assert(value === null || typeof value === "string", "string values must be string")
	} else if (type === "integer") {
		assert(value === null || Number.isSafeInteger(value), "integer values must be numbers")
	} else if (type === "float") {
		assert(value === null || typeof value === "number", "float values must be numbers")
	} else if (type === "bytes") {
		assert(value === null || Buffer.isBuffer(value), "bytes values must be Buffer instances")
	} else if (type === "datetime") {
		assert(value === null || Number.isSafeInteger(value), "datetime values must be numbers")
	} else {
		throw new Error("internal error: invalid type")
	}
}
