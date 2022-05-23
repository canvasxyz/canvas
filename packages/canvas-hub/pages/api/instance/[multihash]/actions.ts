import crypto from "node:crypto"
import assert from "node:assert"

import { NextApiRequest, NextApiResponse } from "next"
import { StatusCodes } from "http-status-codes"

import { loader } from "utils/server/services"
import { Action, actionType } from "@canvas-js/core"
import { APP_MULTIHASH_INVALID, APP_NOT_FOUND, ACTION_FORMAT_INVALID } from "./errors"

import * as t from "io-ts"

const actionArray = t.array(actionType)

/**
 * Get the last ten actions from the hypercore feed of a running app
 */
async function handleGetRequest(req: NextApiRequest, res: NextApiResponse) {
	if (typeof req.query.multihash !== "string") {
		return res.status(StatusCodes.BAD_REQUEST).end(APP_MULTIHASH_INVALID)
	}

	const app = loader.apps.get(req.query.multihash)
	if (app === undefined) {
		return res.status(StatusCodes.NOT_FOUND).end(APP_NOT_FOUND)
	}

	if (app.feed.length === 0) {
		return res.status(StatusCodes.OK).json([])
	}

	const actions: [string, Action][] = []
	for await (const entry of app.getActionStream({ limit: 10 })) {
		actions.push(entry)
	}

	return res.status(StatusCodes.OK).json(actions)
}

/**
 * Apply a new action
 */
async function handlePostRequest(req: NextApiRequest, res: NextApiResponse) {
	if (typeof req.query.multihash !== "string") {
		return res.status(StatusCodes.BAD_REQUEST).end(APP_MULTIHASH_INVALID)
	}

	if (!actionType.is(req.body)) {
		return res.status(StatusCodes.BAD_REQUEST).end(ACTION_FORMAT_INVALID)
	}

	const app = loader.apps.get(req.query.multihash)
	if (app === undefined) {
		return res.status(StatusCodes.NOT_FOUND).end(APP_NOT_FOUND)
	}

	await app
		.apply(req.body)
		.then(() => res.status(StatusCodes.OK).end())
		.catch((err) => res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(err.message))
}

export default async (req: NextApiRequest, res: NextApiResponse) => {
	if (req.method === "GET") {
		await handleGetRequest(req, res)
	} else if (req.method === "POST") {
		await handlePostRequest(req, res)
	} else {
		return res.status(StatusCodes.METHOD_NOT_ALLOWED).end()
	}
}
