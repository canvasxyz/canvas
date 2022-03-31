import { NextApiRequest, NextApiResponse } from "next"
import { StatusCodes } from "http-status-codes"

import { loader } from "utils/server/services"
import { App } from "utils/server/app"
import { AppData } from "utils/server/types"

export default async (req: NextApiRequest, res: NextApiResponse) => {
	if (req.method !== "GET") {
		return res.status(StatusCodes.METHOD_NOT_ALLOWED).end()
	}

	const result: Record<string, AppData> = {}
	Array.from(loader.apps.entries()).forEach(([slug, app]: [string, App]) => {
		result[slug] = {
			actions: Object.entries(app.actions),
		}
	})
	res.status(StatusCodes.OK).json(result)
}
