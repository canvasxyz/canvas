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

export const getServerSideProps: GetServerSideProps<AppPageProps, AppPageParams> = async (context) => {
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

function Sidebar({ app }) {
	return (
		<div className="">
			<div className="font-semibold mb-3">Spec</div>
			<div className="border rounded overflow-hidden">
				<a
					className={`text-sm px-3 py-1.5 flex gap-4 hover:bg-gray-100 ${
						app.version_number === null ? "!bg-blue-500 text-white" : ""
					}`}
					href="?"
				>
					<span className={`${app.version_number === null ? "font-bold" : ""}`}>Latest</span>
				</a>
				{app.versions.map(({ version_number }, index) => {
					return (
						<a
							key={version_number}
							className={`text-sm px-3 py-1.5 flex gap-4 hover:bg-gray-100 border-t ${
								app.version_number === version_number ? "!bg-blue-500 text-white" : ""
							}`}
							href={`?version=v${version_number}`}
						>
							<span className={`flex-1 ${app.version_number === version_number ? "font-bold" : ""}`}>
								v{version_number}
							</span>
						</a>
					)
				})}
			</div>
		</div>
	)
}

function Actions({ app }) {
	return (
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
	)
}

export default function AppPage({ app }: AppPageProps) {
	const latestVersion = Math.max.apply(
		this,
		app.versions.map((v) => +v.version_number)
	)

	return (
		<div className="flex">
			<div className="flex-1 pr-6">
				<Sidebar app={app} />
			</div>
			<div className="flex-1 pr-6">
				{app.version_number === null ? (
					<Editor key="editor" slug={app.slug} initialValue={app.spec} latestVersion={latestVersion} />
				) : (
					<Viewer value={app.spec} version={app.version_number} />
				)}
			</div>
			<div className="flex-1">
				<div className="font-semibold mb-3">Actions</div>
				<Actions app={app} />
			</div>
		</div>
	)
}
