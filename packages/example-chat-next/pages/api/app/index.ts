import { StatusCodes } from "http-status-codes"
import type { NextApiRequest, NextApiResponse } from "next"

import { handleRoute } from "utils/api"

export default async (req: NextApiRequest, res: NextApiResponse) => {
	const core = global.core
	if (core !== undefined) {
		if (req.method === "GET") {
			await handleRoute(core, [], req, res)
		} else {
			res.status(StatusCodes.METHOD_NOT_ALLOWED).end()
		}
	} else {
		res.status(StatusCodes.INTERNAL_SERVER_ERROR).end()
	}
}
