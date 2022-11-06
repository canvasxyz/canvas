import type { NextApiRequest, NextApiResponse } from "next"
import { StatusCodes } from "http-status-codes"

import { handleSession } from "utils/api"

export default async (req: NextApiRequest, res: NextApiResponse) => {
	const core = global.core
	if (core !== undefined) {
		if (req.method === "POST") {
			await handleSession(core, req, res)
		} else {
			res.status(StatusCodes.METHOD_NOT_ALLOWED).end()
		}
	} else {
		res.status(StatusCodes.INTERNAL_SERVER_ERROR).end()
	}
}
