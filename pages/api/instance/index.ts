import { NextApiRequest, NextApiResponse } from "next"
import { StatusCodes } from "http-status-codes"

import { loader } from "utils/server/services"

export default async (req: NextApiRequest, res: NextApiResponse) => {
	if (req.method !== "GET") {
		return res.status(StatusCodes.METHOD_NOT_ALLOWED).end()
	}

	res.status(StatusCodes.OK).json(Array.from(loader.apps.keys()))
}
