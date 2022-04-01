import { NextApiRequest, NextApiResponse } from "next"
import { StatusCodes } from "http-status-codes"

import { loader } from "utils/server/services"

export default async (req: NextApiRequest, res: NextApiResponse) => {
	if (req.method !== "PUT") {
		return res.status(StatusCodes.METHOD_NOT_ALLOWED).end()
	}

	if (typeof req.query.multihash !== "string") {
		return res.status(StatusCodes.BAD_REQUEST).end()
	}

	await prisma.appVersion.update({
		where: { multihash: req.query.multihash },
		data: { deployed: true },
	})

	await loader
		.start(req.query.multihash)
		.then(() => res.status(StatusCodes.OK).end())
		.catch((err) =>
			res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(err instanceof Error ? err.message : err.toString())
		)
}
