import { NextApiRequest, NextApiResponse } from "next"
import { StatusCodes } from "http-status-codes"

import { loader } from "utils/server/services"
import { Action, actionType, SessionPayload, sessionPayloadType } from "canvas-core"

async function handleGetRequest(req: NextApiRequest, res: NextApiResponse) {
	if (typeof req.query.multihash !== "string") {
		return res.status(StatusCodes.BAD_REQUEST).end()
	}

	const app = loader.apps.get(req.query.multihash)
	if (app === undefined) {
		return res.status(StatusCodes.NOT_FOUND).end()
	}

	const sessionActions: [string, Action][] = []
	for await (const entry of app.getSessionStream({ limit: 10 })) {
		sessionActions.push(entry)
	}

	return res.status(StatusCodes.OK).json(sessionActions)
}

async function handlePostRequest(req: NextApiRequest, res: NextApiResponse) {
	if (typeof req.query.multihash !== "string") {
		return res.status(StatusCodes.BAD_REQUEST).end()
	}

	if (!actionType.is(req.body) || !sessionPayloadType.is(req.body.payload)) {
		return res.status(StatusCodes.BAD_REQUEST).end()
	}

	const app = loader.apps.get(req.query.multihash)
	if (app === undefined) {
		return res.status(StatusCodes.NOT_FOUND).end()
	}

	await app
		.session(req.body)
		.then(() => res.status(StatusCodes.OK).end())
		.catch((err) => res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(err.message))
}

export default async (req: NextApiRequest, res: NextApiResponse) => {
	if (req.method === "GET") {
		await handleGetRequest(req, res)
	} else if (req.method === "POST") {
		await handlePostRequest(req, res)
	} else {
		return res.status(StatusCodes.METHOD_NOT_ALLOWED).end()
	}
}
