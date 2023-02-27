import React, { useState } from "react"
import Toastify from "toastify-js"

import { useConnectOneStep } from "./useConnectOneStep"
import { useConnect } from "wagmi"

import ComposeIcon from "./icons/compose.svg"
import WastebasketIcon from "./icons/wastebasket.svg"
import { LocalNote } from "./EncryptedNote"
import { useNotes } from "./useNotes"

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

const IconButton = ({ icon, onClick, disabled }: { onClick: () => void; icon: any; disabled: boolean }) => {
	return (
		<div
			className={`shrink border rounded ${
				disabled
					? "bg-gray-200 hover:cursor-not-allowed"
					: "bg-gray-50 border-gray-400 drop-shadow-md hover:drop-shadow active:drop-shadow-sm hover:cursor-pointer hover:border-gray-300 hover:bg-gray-100"
			}`}
			onClick={disabled ? () => {} : onClick}
		>
			{icon({ className: disabled ? "stroke-gray-500" : "stroke-black", width: "36px" })}
		</div>
	)
}

export const App: React.FC<{}> = ({}) => {
	const { connectors } = useConnect()
	const connector = connectors[0]
	const { connectionState, connect, disconnect, errors, address, client } = useConnectOneStep({ connector })

	const [selectedNote, setSelectedNote] = useState<string | null>(null)
	const { localNotes, deleteNote, createNewLocalNote, updateNote, updateLocalNote } = useNotes(address, client)

	const currentNote: LocalNote | null = selectedNote ? localNotes[selectedNote] : null

	const showError = (errorMessage: string) => {
		Toastify({
			text: errorMessage,
			duration: 3000,
			// destination: "https://github.com/apvarun/toastify-js",
			newWindow: true,
			close: true,
			gravity: "top", // `top` or `bottom`
			position: "center", // `left`, `center` or `right`
			stopOnFocus: true, // Prevents dismissing of toast on hover
			style: {
				background: "red",
			},
			onClick: function () {}, // Callback after click
		}).showToast()
	}

	return (
		<>
			<div className="flex flex-row h-screen overflow-hidden bg-white">
				{/* sidebar */}
				<div className="w-64 h-full border-solid border-black border-r flex-col flex shrink">
					<div className="h-16 border-b border-black flex shrink p-3">
						<div className="flex-grow"></div>
						<IconButton
							onClick={async () => {
								if (selectedNote) {
									await deleteNote(selectedNote)
								}
							}}
							icon={WastebasketIcon}
							disabled={connectionState !== "connected"}
						/>
					</div>
					<div className="overflow-auto" onClick={() => setSelectedNote(null)}>
						{Object.entries(localNotes)
							.sort(([key_1, note_1], [key_2, note_2]) => {
								return note_2.updated_at - note_1.updated_at
							})
							.map(([key, note]) => (
								<div
									key={`node-${note.local_id}`}
									className={`pt-2 pb-2 pl-4 pr-4 m-2 rounded hover:bg-gray-400 hover:cursor-pointer ${
										selectedNote == note.local_id ? "bg-gray-200" : "bg-gray-50"
									}`}
									onClick={(e) => {
										e.stopPropagation()
										setSelectedNote(note.local_id)
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
						<IconButton
							onClick={() => {
								const newLocalNote = createNewLocalNote()
								setSelectedNote(newLocalNote.local_id)
							}}
							icon={ComposeIcon}
							disabled={connectionState !== "connected"}
						/>
						<div className="flex-grow"></div>
						{/* <div className="shrink">
							<input className="border border-gray-400 rounded h-10 p-2" type="text" placeholder="Search"></input>
						</div> */}
						{errors.map((error, idx) => (
							<div key={`error-${idx}`}>{error.substring(0, 40)}</div>
						))}

						{connectionState == "disconnected" ? (
							<div className="shrink pl-3">
								<div
									className="border border-green-400 bg-green-50 rounded h-10 p-2 drop-shadow-md hover:drop-shadow active:drop-shadow-sm font-semibold hover:cursor-pointer hover:bg-green-100 select-none"
									onClick={() => {
										if (connectors && connectors.length > 0) {
											connect()
										}
									}}
								>
									Connect Wallet
								</div>
							</div>
						) : connectionState == "awaiting_connection" ? (
							<div className="shrink pl-3">
								<div className="border border-orange-400 bg-orange-50 rounded h-10 p-2 font-semibold hover:cursor-pointer hover:bg-orange-100 select-none">
									Connecting...
								</div>
							</div>
						) : connectionState == "awaiting_session" ? (
							<div className="shrink pl-3">
								<div className="border border-orange-400 bg-orange-50 rounded h-10 p-2 font-semibold hover:cursor-pointer hover:bg-orange-100 select-none">
									Logging in...
								</div>
							</div>
						) : (
							<>
								{connectionState == "connected" && (
									<div className="shrink pl-3">
										<div className="rounded h-10 p-2">Connected as {address?.substring(0, 8)}...</div>
									</div>
								)}

								<div className="shrink pl-3">
									<div
										className="border border-red-400 bg-red-50 rounded h-10 p-2 drop-shadow-md hover:drop-shadow active:drop-shadow-sm font-semibold hover:cursor-pointer hover:bg-red-100 select-none"
										onClick={() => {
											if (connectors && connectors.length > 0) {
												disconnect()
											}
										}}
									>
										Disconnect
									</div>
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
									onClick={async () => {
										try {
											await updateNote(currentNote)
										} catch (e: any) {
											if (e.message) {
												showError(`Could not save note: ${e.message}`)
											}
										}
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
