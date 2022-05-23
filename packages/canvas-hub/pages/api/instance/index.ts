import { NextApiRequest, NextApiResponse } from "next"
import { StatusCodes } from "http-status-codes"

import { loader } from "utils/server/services"
import { _sessions } from "@canvas-js/core"
import type { Model } from "@canvas-js/core"

export default async (req: NextApiRequest, res: NextApiResponse) => {
	if (req.method !== "GET") {
		return res.status(StatusCodes.METHOD_NOT_ALLOWED).end()
	}

	const apps: Record<string, { models: Record<string, Model>; actionParameters: Record<string, string[]> }> = {}
	for (const [key, app] of loader.apps.entries()) {
		apps[key] = { models: { ...app.models, _sessions }, actionParameters: app.actionParameters }
	}

	res.status(StatusCodes.OK).json(apps)
}
