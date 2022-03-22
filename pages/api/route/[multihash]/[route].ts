import { NextApiRequest, NextApiResponse } from "next"
import { StatusCodes } from "http-status-codes"

import { loader } from "utils/server/services"

export default async (req: NextApiRequest, res: NextApiResponse) => {
	if (req.method !== "GET") {
		return res.status(StatusCodes.METHOD_NOT_ALLOWED).end()
	}

	console.log("not implememented", loader)

	if (loader.apps[req.query.multihash] === undefined) {
		return res
			.status(StatusCodes.BAD_REQUEST)
			.json({ error: "App not initialized" })
	}

	res.status(StatusCodes.OK).end()
}
