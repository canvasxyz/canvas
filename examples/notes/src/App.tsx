import React, { useEffect, useState } from "react"
import { Connect } from "./Connect"

import { useCanvas, useRoute } from "@canvas-js/hooks"

import { Icon, addIcon } from "@iconify/react/dist/offline"
import compose from "@iconify/icons-openmoji/compose"
import wastebasket from "@iconify/icons-openmoji/wastebasket"

addIcon("compose", compose)
addIcon("wastebasket", wastebasket)

type Note = {
	id: string
	localKey: string
	title: string
	body: string
	from_id: string
	updated_at: number
}

type LocalNote = {
	id?: string
	localKey: string
	title: string
	body: string
	from_id?: string
	updated_at: number
	dirty: boolean
}

function formatUpdatedAt(updatedAtTs: number) {
	const now = new Date()
	const updatedAt = new Date(updatedAtTs)

	const dayMs = 1000 * 60 * 60 * 24

	// create new date objects with the local dates for now and updatedAt
	// where the hour/minute/second/millisecond fields are 0
	const day0now = new Date(now.getFullYear(), now.getMonth(), now.getDay())
	const day0updatedAt = new Date(updatedAt.getFullYear(), updatedAt.getMonth(), updatedAt.getDay())

	const diffMs = day0updatedAt.getTime() - day0now.getTime()
	const diffDays = diffMs / dayMs

	if (diffDays == 0) {
		// return time
		return updatedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "numeric" })
	} else if (diffDays < 7) {
		// return day of week
		return updatedAt.toLocaleDateString(undefined, { weekday: "long" })
	} else {
		return updatedAt.toLocaleDateString()
	}
}

export const App: React.FC<{}> = ({}) => {
	const [selectedNote, setSelectedNote] = useState<string | null>(null)
	const { isLoading, host, dispatch } = useCanvas()
	const { data, error } = useRoute<Note>("/notes", {})
	const [portalVisible, setPortalVisible] = useState(false)

	const [localNotes, setLocalNotes] = useState<Record<string, LocalNote>>({})
	const currentNote: LocalNote | null = selectedNote ? localNotes[selectedNote] : null

	useEffect(() => {
		const localNoteChanges: Record<string, LocalNote> = {}

		for (const note of data || []) {
			const localNote = localNotes[note.id]
			// does localNote exist?
			// if no, create note
			if (!localNote) {
				localNoteChanges[note.id] = { ...note, dirty: false }
				continue
			}

			// is the note on daemon newer?
			if (note.updated_at > localNote.updated_at) {
				// is corresponding local note dirty?
				// if yes, don't copy
				// otherwise overwrite note
				if (!localNote.dirty) {
					localNoteChanges[note.id] = { ...note, dirty: false }
				}
			}
		}

		if (Object.entries(localNoteChanges).length > 0) {
			setLocalNotes({ ...localNotes, ...localNoteChanges })
		}
	}, [data])

	useEffect(() => {
		;(window as any).showPortal = () => {
			setPortalVisible(!portalVisible)
		}
	})

	return (
		<>
			<div className="flex flex-row h-screen overflow-hidden bg-white">
				{/* sidebar */}
				<div className="w-64 h-full border-solid border-black border-r flex-col flex shrink">
					<div className="h-16 border-b border-black flex shrink p-3">
						<div className="flex-grow"></div>
						<div
							className="shrink border border-white hover:border-gray-300 hover:bg-gray-100 rounded hover:cursor-pointer"
							onClick={() => {
								if (currentNote !== null && currentNote.id) {
									dispatch("deleteNote", { id: currentNote.id })
								}
							}}
						>
							<Icon icon="wastebasket" fontSize="36px"></Icon>
						</div>
					</div>
					<div
						className="flex-col grow"
						onClick={() => {
							console.log("clicked on list")
							setSelectedNote(null)
						}}
					>
						{Object.entries(localNotes)
							.sort(([key_1, note_1], [key_2, note_2]) => {
								return note_2.updated_at - note_1.updated_at
							})
							.map(([key, note]) => (
								<div
									key={`node-${note.id}`}
									className={`pt-2 pb-2 pl-4 pr-4 m-2 rounded hover:bg-gray-400 hover:cursor-pointer ${
										selectedNote == note.id ? "bg-gray-100" : "bg-white"
									}`}
									onClick={(e) => {
										e.stopPropagation()
										setSelectedNote(note.id || null)
									}}
								>
									<div className="text-sm font-bold">
										{note.title.substring(0, 30)}
										{note.title.length > 30 && "..."}
									</div>
									<div className="text-sm">
										{formatUpdatedAt(note.updated_at)}
										&nbsp;
										{note.body.substring(0, 30)}
										{note.body.length > 30 && "..."}
									</div>
								</div>
							))}
					</div>
				</div>
				{/* main content */}
				<div className="overflow-y-auto overflow-x-hidden relative flex flex-col grow">
					{/* top bar? */}
					<div className="h-16 border-b border-black p-3 flex">
						<div
							className="shrink border border-white hover:border-gray-300 hover:bg-gray-100 rounded hover:cursor-pointer"
							onClick={() => {
								dispatch("createNote", { content: "whatever", title: "something" })
							}}
						>
							<Icon icon="compose" fontSize="36px"></Icon>
						</div>
						<div className="flex-grow"></div>
						<div className="shrink">
							<input className="border border-gray-400 rounded h-10 p-2" type="text" placeholder="Search"></input>
						</div>
						<div className="shrink pl-3">
							<div
								className="border border-blue-400 bg-blue-50 rounded h-10 p-2 font-semibold"
								onClick={() => setPortalVisible(true)}
							>
								Log in
							</div>
						</div>
					</div>
					{/* note content area */}
					{currentNote && selectedNote ? (
						<div className="pl-5 pr-5 pt-3 pb-3 grow">
							<input
								type="text"
								className="text-xl font-bold"
								value={currentNote.title}
								onChange={(e) => {
									const newLocalNotes = {
										...localNotes,
									}
									newLocalNotes[selectedNote] = {
										...currentNote,
										title: e.target.value,
										dirty: true,
									}
									setLocalNotes(newLocalNotes)
								}}
							/>
							<div className="pt-2">{currentNote.body}</div>
							<div className="absolute right-10 bottom-10 border border-gray-400 p-3 rounded-lg bg-gray-200 hover:bg-gray-300 hover:cursor-pointer">
								Save
							</div>
						</div>
					) : (
						<div className="m-auto text-3xl font-semibold text-gray-500">No note is selected</div>
					)}
				</div>
			</div>
			{/* portal background */}
			{portalVisible && (
				<>
					<div className="absolute left-0 top-0 overflow-hidden h-screen w-screen bg-gray-500 opacity-50"></div>
					<div className="absolute left-0 top-0 overflow-hidden h-screen w-screen">
						<div className="m-auto mt-48 opacity-100 bg-red-500 w-80 z-20 p-5">
							<div className="text-xl font-bold">Log in</div>
							<Connect></Connect>
							<div className="border border-black rounded" onClick={() => setPortalVisible(false)}>
								Close
							</div>
						</div>
					</div>
				</>
			)}
		</>
	)
}
