import React, { useEffect, useState } from "react"
import { v4 as uuidv4 } from "uuid"

import { Connect } from "./Connect"

import { ethers } from "ethers"
import { useAccount, useConnect, useDisconnect, useSigner, useNetwork } from "wagmi"
import { useSession, useCanvasSigner } from "@canvas-js/hooks"

import { useCanvas, useRoute } from "@canvas-js/hooks"

import { Icon, addIcon } from "@iconify/react/dist/offline"
import compose from "@iconify/icons-openmoji/compose"
import wastebasket from "@iconify/icons-openmoji/wastebasket"

addIcon("compose", compose)
addIcon("wastebasket", wastebasket)

type Note = {
	id: string
	local_key: string
	title: string
	body: string
	from_id: string
	updated_at: number
}

type LocalNote = {
	id?: string
	local_key: string
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
	const { connect, connectors } = useConnect()
	const { disconnect } = useDisconnect()
	const { isConnected } = useAccount()
	const { error: signerError, data: ethersSigner } = useSigner<ethers.providers.JsonRpcSigner>()
	const { chain } = useNetwork()
	const signer = useCanvasSigner(ethersSigner!, ethers.providers.getNetwork(chain?.id!))
	const { error: sessionError, sessionAddress, login, logout, isPending } = useSession(signer!)

	const [selectedNote, setSelectedNote] = useState<string | null>(null)
	const { isLoading, host, dispatch } = useCanvas()
	const { data, error } = useRoute<Note>("/notes", {})

	const [localNotes, setLocalNotes] = useState<Record<string, LocalNote>>({})
	const currentNote: LocalNote | null = selectedNote ? localNotes[selectedNote] : null

	useEffect(() => {
		const localNoteChanges: Record<string, LocalNote> = {}

		for (const note of data || []) {
			const localNote = localNotes[note.local_key]
			// does localNote exist?
			// if no, create note
			if (!localNote) {
				localNoteChanges[note.local_key] = { ...note, dirty: false }
				continue
			}

			// is the note on daemon newer?
			if (note.updated_at > localNote.updated_at) {
				// is corresponding local note dirty?
				// if yes, don't copy
				// otherwise overwrite note
				if (!localNote.dirty) {
					localNoteChanges[note.local_key] = { ...note, dirty: false }
				}
			}
		}

		if (Object.entries(localNoteChanges).length > 0) {
			setLocalNotes({ ...localNotes, ...localNoteChanges })
		}
	}, [data])

	const updateLocalNote = (localKey: string, changedFields: Record<string, any>) => {
		const newLocalNotes = {
			...localNotes,
		}
		const localNote = localNotes[localKey]
		newLocalNotes[localKey] = {
			...localNote,
			...changedFields,
			dirty: true,
		}
		setLocalNotes(newLocalNotes)
	}

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
								if (selectedNote && currentNote) {
									// delete from local copy
									const { [selectedNote]: deletedLocalNote, ...otherLocalNotes } = localNotes
									setLocalNotes(otherLocalNotes)

									// delete on canvas
									if (currentNote.id) {
										dispatch("deleteNote", { id: currentNote.id })
									}
								}
							}}
						>
							<Icon icon="wastebasket" fontSize="36px"></Icon>
						</div>
					</div>
					<div className="flex-col grow" onClick={() => setSelectedNote(null)}>
						{Object.entries(localNotes)
							.sort(([key_1, note_1], [key_2, note_2]) => {
								return note_2.updated_at - note_1.updated_at
							})
							.map(([key, note]) => (
								<div
									key={`node-${note.local_key}`}
									className={`pt-2 pb-2 pl-4 pr-4 m-2 rounded hover:bg-gray-400 hover:cursor-pointer ${
										selectedNote == note.local_key ? "bg-gray-100" : "bg-white"
									}`}
									onClick={(e) => {
										e.stopPropagation()
										setSelectedNote(note.local_key)
									}}
								>
									<div className="text-sm font-bold">
										{note.title.substring(0, 30) || "Untitled"}
										{note.title.length > 30 && "..."}
									</div>
									<div className="text-sm">
										{formatUpdatedAt(note.updated_at)}
										&nbsp;
										<span className="pl-2 text-gray-400">
											{note.body.substring(0, 15)}
											{note.body.length > 15 && "..."}
										</span>
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
								const newLocalNotes = { ...localNotes }
								const newLocalNote = {
									local_key: uuidv4(),
									title: "",
									body: "",
									updated_at: Math.floor(new Date().getTime()),
									dirty: true,
								} as LocalNote
								newLocalNotes[newLocalNote.local_key] = newLocalNote
								setLocalNotes(newLocalNotes)
							}}
						>
							<Icon icon="compose" fontSize="36px"></Icon>
						</div>
						<div className="flex-grow"></div>
						{/* <div className="shrink">
							<input className="border border-gray-400 rounded h-10 p-2" type="text" placeholder="Search"></input>
						</div> */}

						{!isConnected ? (
							<div className="shrink pl-3">
								<div
									className="border border-green-400 bg-green-50 rounded h-10 p-2 font-semibold hover:cursor-pointer hover:bg-green-100 select-none"
									onClick={() => {
										if (connectors && connectors.length > 0) {
											connect({ connector: connectors[0] })
										}
									}}
								>
									Connect Wallet
								</div>
							</div>
						) : (
							<>
								<div className="shrink pl-3">
									<div
										className="border border-red-400 bg-red-50 rounded h-10 p-2 font-semibold hover:cursor-pointer hover:bg-red-100 select-none"
										onClick={() => {
											if (connectors && connectors.length > 0) {
												disconnect()
											}
										}}
									>
										Disconnect
									</div>
								</div>
								<div className="shrink pl-3">
									{sessionAddress === null ? (
										<div
											className="border border-blue-400 bg-blue-50 rounded h-10 p-2 font-semibold hover:cursor-pointer hover:bg-blue-100 select-none"
											onClick={() => {
												if (!isLoading && !isPending) {
													login()
												}
											}}
										>
											Log in
										</div>
									) : (
										<div
											className="border border-blue-400 bg-blue-50 rounded h-10 p-2 font-semibold hover:cursor-pointer hover:bg-blue-100 select-none"
											onClick={() => {
												if (!isLoading) {
													logout()
												}
											}}
										>
											Log out
										</div>
									)}
								</div>
							</>
						)}
					</div>
					{/* note content area */}
					{currentNote && selectedNote ? (
						<div className="pl-5 pr-5 pt-3 pb-3 grow">
							<div className="flex flex-col">
								<input
									placeholder="Title"
									type="text"
									className="text-xl font-bold border border-black p-1 rounded-md"
									value={currentNote.title}
									onChange={(e) => {
										updateLocalNote(selectedNote, { title: e.target.value })
									}}
								/>
								<textarea
									placeholder="..."
									className="border border-black p-1 mt-2 rounded-md h-200"
									value={currentNote.body}
									onChange={(e) => {
										updateLocalNote(selectedNote, { body: e.target.value })
									}}
								/>
							</div>
							{currentNote.dirty && (
								<div
									className="absolute right-10 bottom-10 border border-gray-400 p-3 rounded-lg bg-gray-200 hover:bg-gray-300 hover:cursor-pointer"
									onClick={() => {
										// update canvas
										dispatch("createUpdateNote", {
											id: currentNote.id || "",
											local_key: currentNote.local_key,
											body: currentNote.body,
											title: currentNote.title,
										})

										// set the note to clean
										const newLocalNotes = {
											...localNotes,
										}
										newLocalNotes[selectedNote] = {
											...currentNote,
											dirty: false,
										}
										setLocalNotes(newLocalNotes)
									}}
								>
									Save
								</div>
							)}
						</div>
					) : (
						<div className="m-auto text-3xl font-semibold text-gray-500">No note is selected</div>
					)}
				</div>
			</div>
		</>
	)
}
