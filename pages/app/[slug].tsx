import React from "react"

import type { GetServerSideProps } from "next"

import { prisma } from "utils/server/services"
import { Editor } from "components/Editor"

interface AppPageProps {
	app: {
		slug: string
		draft_spec: string
		last_version_number: number | null
		versions: {
			version_number: number
			created_at: string
		}[]
	}
}

type AppPageParams = { slug: string; version?: string }

export const getServerSideProps: GetServerSideProps<
	AppPageProps,
	AppPageParams
> = async (context) => {
	const { slug } = context.params!

	const app = await prisma.app.findUnique({
		select: {
			slug: true,
			draft_spec: true,
			last_version: { select: { version_number: true } },
			versions: { select: { version_number: true, created_at: true } },
		},
		where: { slug },
	})

	if (app === null) {
		return { notFound: true }
	} else {
		const { last_version, draft_spec, versions } = app
		return {
			props: {
				app: {
					slug,
					draft_spec,
					last_version_number: last_version && last_version.version_number,
					versions: versions.map(({ version_number, created_at }) => ({
						version_number,
						created_at: created_at.toISOString(),
					})),
				},
			},
		}
	}
}

export default function AppPage({ app }: AppPageProps) {
	return (
		<div className="max-w-xl my-8 mx-auto">
			<h1 className="text-3xl my-2">/app/{app.slug}</h1>
			<Editor initialValue={app.draft_spec} />
			<ul>
				{app.versions.map(({ version_number, created_at }) => (
					<li key={version_number}>
						<span>v{version_number}</span>
						published on
						<span>{created_at}</span>
					</li>
				))}
			</ul>
		</div>
	)
}
