import { NextApiRequest, NextApiResponse } from "next"
import { StatusCodes } from "http-status-codes"

import { loader } from "utils/server/services"

export default async (req: NextApiRequest, res: NextApiResponse) => {
	if (req.method !== "GET") {
		return res.status(StatusCodes.METHOD_NOT_ALLOWED).end()
	}

	if (typeof req.query.multihash !== "string") {
		return res.status(StatusCodes.BAD_REQUEST).end()
	}

	if (typeof req.query.model !== "string") {
		return res.status(StatusCodes.BAD_REQUEST).end()
	}

	const app = loader.apps.get(req.query.multihash)
	if (app === undefined) {
		return res.status(StatusCodes.NOT_FOUND).end()
	}

	const model = app.models[req.query.model]
	if (model === undefined) {
		return res.status(StatusCodes.NOT_FOUND).end()
	}

	const rows = app.database.prepare(`SELECT * FROM ${req.query.model} ORDER BY timestamp DESC LIMIT 10`).all()
	return res.status(StatusCodes.OK).json(rows)
}
