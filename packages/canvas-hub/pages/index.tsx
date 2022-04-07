import React, { useContext } from "react"

import type { GetServerSideProps } from "next"

import { prisma } from "utils/server/services"
import Link from "next/link"

interface IndexPageProps {
	apps: {
		id: number
		slug: string
		created_at: string
		updated_at: string
		// last_version_number: number | null
		// last_multihash: string | null
		running_version_multihash: string | null
		running_versions: number
	}[]
}

export const getServerSideProps: GetServerSideProps<IndexPageProps> = async (context) => {
	const apps = await prisma.app.findMany({
		select: {
			id: true,
			slug: true,
			created_at: true,
			updated_at: true,
			// last_version: { select: { version_number: true, multihash: true } },
			versions: {
				select: {
					version_number: true,
					multihash: true,
					deployed: true,
				},
				where: {
					deployed: true,
				},
			},
		},
	})

	return {
		props: {
			apps: apps.map(({ id, slug, created_at, updated_at, /*last_version, */ versions }) => ({
				id,
				slug,
				created_at: created_at.toISOString(),
				updated_at: updated_at.toISOString(),
				// last_version_number: last_version && last_version.version_number,
				// last_multihash: last_version && last_version.multihash,
				running_version_multihash: versions[0] ? versions[0].multihash : null,
				running_versions: versions.length,
			})),
		},
	}
}

export default function IndexPage({ apps }: IndexPageProps) {
	return (
		<div className="w-96">
			<h1 className="font-semibold mt-2 mb-4">Projects</h1>
			<div className="my-2">
				{apps.map(
					({ id, slug, /*last_version_number, last_multihash, */ running_version_multihash, running_versions }) => (
						<a
							href={`/app/${slug}`}
							key={id}
							className="block px-4 py-2.5 mb-2 border border-gray-200 hover:border-gray-300 rounded bg-white shadow-sm"
						>
							<div className="mb-0.5 text-lg font-semibold">{slug}</div>
							<div className="text-sm text-gray-500 mb-1">
								<div className="leading-tight">
									{running_version_multihash ? (
										<div className="inline-block rounded px-1.5 py-0.5 mr-2 text-xs bg-green-600 text-white">
											Running
										</div>
									) : (
										<div className="inline-block rounded px-1.5 py-0.5 mr-2 text-xs bg-red-500 text-white">Stopped</div>
									)}
									{running_version_multihash === null ? (
										<span>Offline</span>
									) : (
										<span>
											{running_version_multihash.slice(0, 6)}{" "}
											{running_versions > 1 && `and ${running_versions - 1} other${running_versions > 2 ? "s" : ""}`}
										</span>
									)}
								</div>
							</div>
						</a>
					)
				)}
			</div>

			<Link href="/new">
				<a className="block mt-4 p-2 rounded bg-blue-500 hover:bg-blue-500 font-semibold text-sm text-center text-white">
					New project
				</a>
			</Link>
		</div>
	)
}
