import { NextApiRequest, NextApiResponse } from "next"
import { StatusCodes } from "http-status-codes"

import { loader } from "utils/server/services"
import type { AppStatus } from "canvas-core"

export default async (req: NextApiRequest, res: NextApiResponse<AppStatus>) => {
	if (req.method !== "GET") {
		return res.status(StatusCodes.METHOD_NOT_ALLOWED).end()
	}

	if (typeof req.query.multihash !== "string") {
		return res.status(StatusCodes.BAD_REQUEST).end()
	}

	const status = loader.status.get(req.query.multihash)
	if (status === undefined) {
		return res.status(StatusCodes.NOT_FOUND).end()
	}

	return res.status(StatusCodes.OK).json(status)
}
