import React from "react"

import type { GetServerSideProps } from "next"

import { prisma } from "utils/server/services"

interface AppPageProps {
	app: {
		slug: string
	}
}

type AppPageParams = { slug: string }

export const getServerSideProps: GetServerSideProps<
	AppPageProps,
	AppPageParams
> = async (context) => {
	const { slug } = context.params!

	const app = await prisma.app.findUnique({
		select: { slug: true },
		where: { slug },
	})

	if (app === null) {
		return { notFound: true }
	} else {
		return { props: { app } }
	}
}

export default function AppPage({ app }: AppPageProps) {
	return (
		<div className="max-w-xl my-8 mx-auto">
			<h1 className="text-3xl my-2">/app/{app.slug}</h1>
		</div>
	)
}
