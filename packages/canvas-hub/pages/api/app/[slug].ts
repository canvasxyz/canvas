import { NextApiRequest, NextApiResponse } from "next"
import { StatusCodes } from "http-status-codes"

import Hash from "ipfs-only-hash"
import { prisma } from "utils/server/services"

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

	const multihash = await Hash.of(spec)
	console.log("multihash", multihash)

	const app = await prisma.app.findUnique({
		where: { slug },
		select: {
			id: true,
			last_version: { select: { version_number: true, multihash: true } },
		},
	})

	if (app === null) {
		return res.status(StatusCodes.NOT_FOUND).end()
	}

	// const last_multihash = app.last_version && app.last_version.multihash

	const last_version_number = app.last_version && app.last_version.version_number

	const version_number = last_version_number === null ? 0 : last_version_number + 1

	// For now, just let the user to manually start / stop things
	// // Stop the previous version, if it exists
	// if (last_multihash !== null) {
	// 	if (last_multihash in loader.apps) {
	// 		await loader.stopApp(last_multihash)
	// 	}
	// }

	// // Start the new app verion!!
	// await loader.startApp(multihash)

	await prisma.appVersion
		.create({
			data: {
				app_id: app.id,
				spec,
				version_number,
				multihash,
				is_last_version: { connect: { id: app.id } },
				deployed: false,
			},
		})
		.then(() => res.status(StatusCodes.CREATED).setHeader("Location", `/app/${slug}?version=v${version_number}`).end())
		.catch(() => res.status(StatusCodes.CONFLICT).end())
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

	await prisma.app
		.update({
			where: { slug },
			data: { draft_spec },
		})
		.then(() => res.status(StatusCodes.OK).end())
		.catch(() => res.status(StatusCodes.INTERNAL_SERVER_ERROR).end())
}

async function handleDeleteRequest(req: NextApiRequest, res: NextApiResponse) {
	const { slug } = req.query
	if (typeof slug !== "string") {
		return res.status(StatusCodes.BAD_REQUEST).end()
	}

	const app = await prisma.app.findUnique({
		where: { slug },
		select: {
			id: true,
			versions: {
				select: { version_number: true, multihash: true, spec: true, deployed: true },
				orderBy: { version_number: "desc" },
			},
		},
	})

	if (app === null) {
		return res.status(StatusCodes.NOT_FOUND).end()
	}

	// cannot delete apps with running specs
	if (app.versions.some((version) => version.deployed)) {
		return res.status(StatusCodes.CONFLICT).end()
	}

	await prisma.app
		.delete({
			where: { slug },
		})
		.then(() => res.status(StatusCodes.OK).end())
		.catch(() => res.status(StatusCodes.INTERNAL_SERVER_ERROR).end())
}

export default async (req: NextApiRequest, res: NextApiResponse) => {
	if (req.method === "POST") {
		await handlePostRequest(req, res)
	} else if (req.method === "PUT") {
		await handlePutRequest(req, res)
	} else if (req.method === "DELETE") {
		await handleDeleteRequest(req, res)
	} else {
		return res.status(StatusCodes.METHOD_NOT_ALLOWED).end()
	}
}
