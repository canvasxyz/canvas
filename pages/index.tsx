import React, { useState } from "react"
import useSWR from "swr"
import type { GetServerSideProps } from "next"

import { loader, prisma } from "utils/server/services"
import Link from "next/link"

// const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface IndexPageProps {
	apps: {
		id: number
		slug: string
		created_at: string
		updated_at: string
		last_version_number: number | null
	}[]
}

export const getServerSideProps: GetServerSideProps<IndexPageProps> = async (
	context
) => {
	const apps = await prisma.app.findMany({
		select: {
			id: true,
			slug: true,
			created_at: true,
			updated_at: true,
			last_version: { select: { version_number: true } },
		},
	})

	return {
		props: {
			apps: apps.map(({ id, slug, created_at, updated_at, last_version }) => ({
				id,
				slug,
				created_at: created_at.toISOString(),
				updated_at: updated_at.toISOString(),
				last_version_number: last_version && last_version.version_number,
			})),
		},
	}
}

export default function IndexPage({ apps }: IndexPageProps) {
	// const [spec, setSpec] = useState<null | string>(null);
	// const { data: info } = useSWR(`/info`, fetcher);
	// const { data: actionsData } = useSWR(() => spec && `/actions/${spec}`, fetcher);

	return (
		<div className="max-w-xl my-8 mx-auto">
			<h1 className="text-3xl my-2">My Projects</h1>
			<div className="my-2">
				{apps.map(({ id, slug, last_version_number }) => (
					<div key={id} className="border border-gray">
						<h2 className="m-2">{slug}</h2>
						<div className="m-2">
							<span>v{last_version_number}</span>
						</div>
					</div>
				))}
			</div>

			<Link href="/new">
				<a className="block my-2 p-2 rounded bg-blue-600 text-center text-white">
					New project
				</a>
			</Link>
		</div>
	)
}
