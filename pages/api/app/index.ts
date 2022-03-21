import { NextApiRequest, NextApiResponse } from "next"
import { StatusCodes } from "http-status-codes"

import { prisma } from "utils/server/services"
import { getDefaultSpecTemplate } from "utils/server/defaultSpecTemplate"
import { alphanumeric } from "utils/shared/regexps"

import * as t from "io-ts"

const postRequestBody = t.type({ slug: t.string })

export default async (req: NextApiRequest, res: NextApiResponse) => {
	if (req.method !== "POST") {
		return res.status(StatusCodes.METHOD_NOT_ALLOWED).end()
	}

	if (!postRequestBody.is(req.body)) {
		return res.status(StatusCodes.BAD_REQUEST).end()
	}

	if (!alphanumeric.test(req.body.slug)) {
		return res.status(StatusCodes.BAD_REQUEST).end()
	}

	const { slug } = await prisma.app.create({
		select: { slug: true },
		data: { ...req.body, draft_spec: getDefaultSpecTemplate() },
	})

	res.status(StatusCodes.CREATED).setHeader("Location", `/app/${slug}`).end()
}
