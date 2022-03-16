import { NextApiRequest, NextApiResponse } from "next"
import { StatusCodes } from "http-status-codes"

// import * as t from "io-ts"

import { loader } from "utils/server/services"

// const postRequestBody = t.type({
// 	from: t.string,
// 	signature: t.string,
// 	data: t.type({
// 		app: t.string,
// 		action: t.string,
// 		blockhash: t.union([t.string, t.null]), // TODO: make non-nullable
// 		timestamp: t.number,
// 		args: t.record(t.string, t.union([t.null, t.boolean, t.string, t.number])),
// 	}),
// })

export default async (req: NextApiRequest, res: NextApiResponse) => {
	if (req.method !== "POST") {
		return res.status(StatusCodes.METHOD_NOT_ALLOWED).end()
	}

	console.log("not implememented", loader)

	res.status(200).end()
}
