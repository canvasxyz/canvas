import crypto from "node:crypto"

import { NextApiRequest, NextApiResponse } from "next"
import { StatusCodes } from "http-status-codes"

import { loader } from "utils/server/services"
import { Action, actionType } from "core/actions"

import * as t from "io-ts"

const actionArray = t.array(actionType)

async function handleGetRequest(req: NextApiRequest, res: NextApiResponse) {
	if (typeof req.query.multihash !== "string") {
		return res.status(StatusCodes.BAD_REQUEST).end()
	}

	const app = loader.apps.get(req.query.multihash)
	if (app === undefined) {
		return res.status(StatusCodes.NOT_FOUND).end()
	}

	if (app.feed.length === 0) {
		return res.status(StatusCodes.OK).json([])
	}

	const actions = await new Promise<[string, Action][]>((resolve, reject) => {
		const start = Math.max(app.feed.length - 10, 0)
		app.feed.getBatch(start, app.feed.length, (err, data) => {
			if (err !== null) {
				reject(err)
			} else if (!actionArray.is(data)) {
				reject(new Error("got invalid data from hypercore feed"))
			} else {
				resolve(data.map((d) => [crypto.createHash("sha256").update(d.signature).digest("hex"), d]))
			}
		})
	})

	return res.status(StatusCodes.OK).json(actions)
}

async function handlePostRequest(req: NextApiRequest, res: NextApiResponse) {
	if (typeof req.query.multihash !== "string") {
		return res.status(StatusCodes.BAD_REQUEST).end()
	}

	console.log("posting action", req.query.multihash, req.body)

	if (!actionType.is(req.body)) {
		return res.status(StatusCodes.BAD_REQUEST).end()
	}

	const app = loader.apps.get(req.query.multihash)
	if (app === undefined) {
		return res.status(StatusCodes.NOT_FOUND).end()
	}

	await app
		.apply(req.body)
		.then(() => res.status(StatusCodes.OK).end())
		.catch((err) => res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(err.toString()))
}

/**
 * Get the last ten actions from the hypercore feed of a running app
 */
export default async (req: NextApiRequest, res: NextApiResponse) => {
	if (req.method === "GET") {
		await handleGetRequest(req, res)
	} else if (req.method === "POST") {
		await handlePostRequest(req, res)
	} else {
		return res.status(StatusCodes.METHOD_NOT_ALLOWED).end()
	}
}
