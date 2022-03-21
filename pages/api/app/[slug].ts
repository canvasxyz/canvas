import { NextApiRequest, NextApiResponse } from "next"
import { StatusCodes } from "http-status-codes"

import { prisma, ipfs } from "utils/server/services"

import * as t from "io-ts"

const postRequestBody = t.type({ spec: t.string })

async function handlePostRequest(req: NextApiRequest, res: NextApiResponse) {
	const { slug } = req.query
	if (typeof slug !== "string") {
		return res.status(StatusCodes.BAD_REQUEST).end()
	}

	if (!postRequestBody.is(req.body)) {
		return res.status(StatusCodes.BAD_REQUEST).end()
	}

	const { spec } = req.body

	const { cid } = await ipfs.add(spec)
	const multihash = cid.toV0().toString()
	console.log("cid", multihash)

	const app = await prisma.app.findUnique({
		where: { slug },
		select: { id: true, last_version: { select: { version_number: true } } },
	})

	if (app === null) {
		return res.status(StatusCodes.NOT_FOUND).end()
	}

	const version_number =
		app.last_version === null ? 0 : app.last_version.version_number + 1

	// In order to update the last_version pointer in the same transaction we
	// phrase this as an update to prisma.app that happens to create an app_version
	await prisma.app.update({
		where: { id: app.id },
		data: {
			last_version: {
				create: { app_id: app.id, spec, version_number, multihash },
			},
		},
	})

	res
		.status(StatusCodes.CREATED)
		.setHeader("Location", `/app/${slug}?version=v${version_number}`)
		.setHeader("ETag", `"${multihash}"`)
		.end()
}

const putRequestBody = t.type({ draft_spec: t.string })

async function handlePutRequest(req: NextApiRequest, res: NextApiResponse) {
	const { slug } = req.query
	if (typeof slug !== "string") {
		return res.status(StatusCodes.BAD_REQUEST).end()
	}

	if (!putRequestBody.is(req.body)) {
		return res.status(StatusCodes.BAD_REQUEST).end()
	}

	const { draft_spec } = req.body

	const app = await prisma.app.update({
		where: { slug },
		data: { draft_spec },
		select: { id: true },
	})

	return res.status(StatusCodes.OK).end()
}

export default async (req: NextApiRequest, res: NextApiResponse) => {
	if (req.method === "POST") {
		await handlePostRequest(req, res)
	} else if (req.method === "PUT") {
		await handlePutRequest(req, res)
	} else {
		return res.status(StatusCodes.METHOD_NOT_ALLOWED).end()
	}
}
