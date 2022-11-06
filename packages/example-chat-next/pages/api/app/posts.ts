import { StatusCodes } from "http-status-codes"
import type { NextApiRequest, NextApiResponse } from "next"

import { handleRoute } from "utils/api"

export default async (req: NextApiRequest, res: NextApiResponse) => {
	const core = global.core
	if (core !== undefined) {
		await handleRoute(core, ["posts"], req, res)
	} else {
		res.status(StatusCodes.INTERNAL_SERVER_ERROR).end()
	}
}
