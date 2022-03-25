import React from "react"

import type { GetServerSideProps } from "next"

import { prisma } from "utils/server/services"
import { Editor } from "components/SpecEditor"
import { Viewer } from "components/SpecViewer"

interface AppPageProps {
	app: {
		slug: string
		version_number: number | null
		spec: string
		updated_at: number
		versions: {
			version_number: number
			created_at: number
		}[]
	}
}

/**
 * This page /app/[slug], by default, renders the draft_spec of the app
 * in an editable CodeMirror editor. Putting a version number in the query
 * string e.g. /app/[slug]?version=v8 will render a the spec of that version
 * in a readonly CodeMirror editor.
 */

type AppPageParams = { slug: string; version?: string }

export const getServerSideProps: GetServerSideProps<
	AppPageProps,
	AppPageParams
> = async (context) => {
	const { slug } = context.params!

	const app = await prisma.app.findUnique({
		select: {
			id: true,
			draft_spec: true,
			updated_at: true,
			versions: {
				select: { version_number: true, created_at: true },
				orderBy: { version_number: "desc" },
			},
		},
		where: { slug },
	})

	if (app === null) {
		return { notFound: true }
	}

	const updated_at = app.updated_at.valueOf()

	const versions = app.versions.map(({ version_number, created_at }) => ({
		version_number,
		created_at: created_at.valueOf(),
	}))

	const { version } = context.query
	if (version === undefined) {
		const spec = app.draft_spec
		return {
			props: {
				app: { slug, version_number: null, spec, updated_at, versions },
			},
		}
	}

	if (typeof version !== "string") {
		return { notFound: true }
	}

	const match = version.match(/^v(\d+)$/)
	if (match === null) {
		return { notFound: true }
	}

	const [_, v] = match
	const version_number = parseInt(v)

	const appVersion = await prisma.appVersion.findUnique({
		where: { app_id_version_number: { app_id: app.id, version_number } },
		select: { spec: true },
	})

	if (appVersion === null) {
		return { notFound: true }
	}

	return {
		props: {
			app: {
				slug,
				version_number,
				spec: appVersion.spec,
				updated_at,
				versions,
			},
		},
	}
}

export default function AppPage({ app }: AppPageProps) {
	return (
		<div className="flex">
			<div className="flex-1 pr-6">
				<div className="font-semibold mb-3">Spec</div>
				{app.version_number === null ? (
					<Editor key="editor" slug={app.slug} initialValue={app.spec} />
				) : (
					<Viewer value={app.spec} />
				)}

				<div className="my-4">
					<a
						className={
							app.version_number === null
								? "my-2 border p-2 rounded flex place-content-between bg-gray-100"
								: "my-2 border p-2 rounded flex place-content-between"
						}
						href="?"
					>
						<span
							className={
								app.version_number === null ? "italic font-bold" : "italic"
							}
						>
							draft
						</span>
					</a>
					<div className="my-2 border rounded">
						{app.versions.map(({ version_number }, index) => {
							let className = "p-2 flex gap-4"
							if (index > 0) {
								className += " border-t"
							}
							if (app.version_number === version_number) {
								className += " bg-gray-100"
							}
							return (
								<a
									key={version_number}
									className={className}
									href={`?version=v${version_number}`}
								>
									<span
										className={
											app.version_number === version_number
												? "flex-1 font-mono font-bold"
												: "flex-1 font-mono"
										}
									>
										v{version_number}
									</span>
								</a>
							)
						})}
					</div>
				</div>
			</div>
			<div className="flex-1">
				<div className="font-semibold mb-3">Actions</div>
				<div className="">
					<table className="table-auto text-left text-sm leading-snug w-full">
						<thead className="border-b border-gray-300">
							<tr>
								<th className="pb-1.5">Col 1</th>
								<th className="pb-1.5">Col 2</th>
								<th className="pb-1.5">Col 3</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td className="pt-1.5">e...</td>
								<td className="pt-1.5">0x100...</td>
								<td className="pt-1.5">defgh...</td>
							</tr>
							<tr>
								<td className="pt-1.5">abcde...</td>
								<td className="pt-1.5">0x100...</td>
								<td className="pt-1.5">defgh...</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	)
}
