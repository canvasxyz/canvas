import React, { useState } from "react"

import type { GetServerSideProps } from "next"

import { prisma } from "utils/server/services"
import { Editor } from "components/SpecEditor"
import { Viewer } from "components/SpecViewer"
import { Actions } from "components/SpecActions"
import { Sidebar } from "components/SpecSidebar"

interface AppPageProps {
	app: {
		slug: string
		version_number: number | null
		spec: string
		updated_at: number
		versions: {
			version_number: number
			created_at: number
			spec: string
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
				select: { version_number: true, created_at: true, spec: true },
				orderBy: { version_number: "desc" },
			},
		},
		where: { slug },
	})

	if (app === null) {
		return { notFound: true }
	}

	const updated_at = app.updated_at.valueOf()

	const versions = app.versions.map(({ version_number, created_at, spec }) => ({
		spec,
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
	const [latestEdit, saveLatestEdit] = useState()
	const latestVersion = Math.max.apply(
		this,
		app.versions.map((v) => +v.version_number)
	)
	const matchesPreviousVersion =
		app.version_number === null && app.versions.find((v) => v.spec === (latestEdit || app.spec))?.version_number

	return (
		<div className="flex">
			<div className="w-60 pr-6">
				<Sidebar app={app} />
			</div>
			{app.version_number === null ? (
				<Editor
					key="editor"
					slug={app.slug}
					initialValue={app.spec}
					latestVersion={latestVersion}
					matchesPreviousVersion={matchesPreviousVersion}
					onSaved={(draft) => saveLatestEdit(draft)}
					onEdited={(draft) => saveLatestEdit(draft)}
				/>
			) : (
				<Viewer value={app.spec} version={app.version_number} />
			)}
			<div className="w-96 pl-6">
				<div className="font-semibold mb-3">Actions</div>
				<Actions app={app} />
			</div>
		</div>
	)
}
