import React from "react"

import type { GetServerSideProps } from "next"

import type { EditorState } from "@codemirror/state"

import { prisma } from "utils/server/services"
import { Editor } from "components/SpecEditor"
import { useDebouncedCallback } from "use-debounce"
import { Viewer } from "components/SpecViewer"

interface AppPageProps {
	app: {
		slug: string
		version_number: number | null
		spec: string
		versions: {
			version_number: number
			created_at: string
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
			versions: { select: { version_number: true, created_at: true } },
		},
		where: { slug },
	})

	if (app === null) {
		return { notFound: true }
	}

	const versions = app.versions.map(({ version_number, created_at }) => ({
		version_number,
		created_at: created_at.toISOString(),
	}))

	const { version } = context.query
	if (version === undefined) {
		const spec = app.draft_spec
		return { props: { app: { slug, version_number: null, spec, versions } } }
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
		props: { app: { slug, version_number, spec: appVersion.spec, versions } },
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

				<ul>
					{app.versions.map(({ version_number, created_at }) => (
						<li key={version_number}>
							<a href={`?version=v${version_number}`}>
								v{version_number} published on {created_at}
							</a>
						</li>
					))}
				</ul>
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
