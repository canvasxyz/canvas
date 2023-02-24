import React, { useEffect, useState } from "react"
import { v4 as uuidv4 } from "uuid"
import Toastify from "toastify-js"

import { useConnectOneStep } from "./useConnectOneStep"
import { useConnect } from "wagmi"
import { Client, useRoute } from "@canvas-js/hooks"

import ComposeIcon from "./icons/compose.svg"
import WastebasketIcon from "./icons/wastebasket.svg"
import { metamaskDecryptData, metamaskEncryptData, metamaskGetPublicKey } from "./crypto"
import nacl from "tweetnacl"

type EncryptedNote = {
	updated_at: number
} & EncryptedNoteFields

type EncryptedNoteFields = {
	id: string

	local_id: string
	key_id: string
	encrypted_body: string
	creator_id: string
	nonce: string
}

type EncryptedKey = {
	id: string
	updated_at: number

	key_id: string
	encrypted_key: string
	owner_id: string
}

type LocalNote = {
	id?: string
	updated_at: number

	local_id: string
	key_id: string
	creator_id: string

	title: string
	body: string
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

const lookupEncryptedKey = (keys: EncryptedKey[], owner_id: string, key_id: string): EncryptedKey | undefined => {
	for (const key of keys) {
		if (key.key_id == key_id && key.owner_id == owner_id) {
			return key
		}
	}
}

const decryptEncryptedKey = async (key: EncryptedKey, account: string): Promise<Buffer> => {
	// decrypt key using metamask (?)
	const c = key?.encrypted_key!
	return await metamaskDecryptData(account, Buffer.from(c, "base64"))
}

const decryptNote = async (
	encryptedNote: EncryptedNote,
	address: string,
	encryptedKeyData: EncryptedKey[]
): Promise<LocalNote> => {
	// look up key
	// look up the note's encryption key
	const encryptedKey = lookupEncryptedKey(encryptedKeyData || [], address, encryptedNote.key_id)
	if (!encryptedKey) {
		throw Error(`can't decrypt note - no key exists for address=${address} key_id=${encryptedNote.key_id}`)
	}
	// decrypt it
	const key = await decryptEncryptedKey(encryptedKey, address)
	const nonceB = Buffer.from(encryptedNote.nonce, "base64")
	const data = nacl.secretbox.open(Buffer.from(encryptedNote.encrypted_body, "base64"), nonceB, key)

	if (!data) {
		throw Error(`No encrypted data was recovered from ${encryptedNote.id}`)
	}

	// use the note's key to decrypt the note data
	const decryptedContent = Buffer.from(data).toString("utf8")
	const { body, title } = JSON.parse(decryptedContent)
	return {
		body,
		title,
		local_id: encryptedNote.local_id,
		creator_id: encryptedNote.creator_id,
		updated_at: encryptedNote.updated_at,
		key_id: encryptedNote.key_id,
		id: encryptedNote.id,
		dirty: false,
	}
}

const encryptNote = async (
	localNote: LocalNote,
	address: string,
	encryptedKeyData: EncryptedKey[],
	client: Client
): Promise<EncryptedNoteFields> => {
	// if the note doesn't have a key yet...
	let noteKey: Uint8Array
	let key_id = localNote.key_id
	if (key_id) {
		const encryptedKey = lookupEncryptedKey(encryptedKeyData || [], address, key_id)
		if (!encryptedKey) {
			throw Error(`can't update note - no key exists for address=${address} key_id=${key_id}`)
		}
		noteKey = await decryptEncryptedKey(encryptedKey, address)
	} else {
		// generate a key
		const pubKey = await metamaskGetPublicKey(address)
		noteKey = nacl.randomBytes(32)
		// save it
		key_id = uuidv4()
		client.uploadKey({
			key_id,
			encrypted_key: metamaskEncryptData(pubKey, Buffer.from(noteKey)).toString("base64"),
			owner_id: address,
		})
	}

	const serializedNoteBody = Buffer.from(JSON.stringify({ body: localNote.body, title: localNote.title }), "utf8")
	const nonce = nacl.randomBytes(24)
	return {
		id: localNote.id || "",
		local_id: localNote.local_id,
		encrypted_body: Buffer.from(nacl.secretbox(serializedNoteBody, nonce, noteKey)).toString("base64"),
		nonce: Buffer.from(nonce).toString("base64"),
		key_id: key_id,
		creator_id: address,
	}
}

export const App: React.FC<{}> = ({}) => {
	const { connectors } = useConnect()
	const connector = connectors[0]
	const { connectionState, connect, disconnect, errors, address, client } = useConnectOneStep({ connector })

	const [selectedNote, setSelectedNote] = useState<string | null>(null)

	const { data: encryptedNoteData } = useRoute<EncryptedNote>("/encrypted_notes", {})
	const { data: encryptedKeyData } = useRoute<EncryptedKey>("/encrypted_keys", {})

	const [localNotes, setLocalNotes] = useState<Record<string, LocalNote>>({})
	const currentNote: LocalNote | null = selectedNote ? localNotes[selectedNote] : null

	useEffect(() => {
		async function generateChanges() {
			if (address == null || encryptedKeyData == null) {
				console.log(`address=${address} encryptedKeyData=${encryptedKeyData}`)
				return {}
			}

			// find the notes that need to be updated
			const notesToUpdate = []
			for (const note of encryptedNoteData || []) {
				const localNote = localNotes[note.local_id]
				// does localNote exist?
				// if no, create note
				if (!localNote || (note.updated_at > localNote.updated_at && !localNote.dirty)) {
					notesToUpdate.push(note)
				}
			}

			const localNoteChanges: Record<string, LocalNote> = {}
			for (const encryptedNote of notesToUpdate) {
				try {
					localNoteChanges[encryptedNote.local_id] = await decryptNote(encryptedNote, address, encryptedKeyData)
				} catch (e) {
					console.log(e)
					continue
				}
			}
			return localNoteChanges
		}

		generateChanges().then((localNoteChanges) => {
			if (Object.entries(localNoteChanges).length > 0) {
				setLocalNotes({ ...localNotes, ...localNoteChanges })
			}
		})
	}, [address, encryptedKeyData, encryptedNoteData])

	const updateNote = async (note: LocalNote) => {
		if (!client || !address) {
			return
		}

		try {
			const encryptedNote = await encryptNote(note, address, encryptedKeyData || [], client)
			await client.updateNote(encryptedNote)
		} catch (e) {
			console.log(e)
			return
		}
	}

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
								if (selectedNote && currentNote && client) {
									// delete from local copy
									const { [selectedNote]: deletedLocalNote, ...otherLocalNotes } = localNotes
									setLocalNotes(otherLocalNotes)

									// delete on canvas
									if (currentNote.id) {
										try {
											await client.deleteNote({ id: currentNote.id })
										} catch (e: any) {
											showError(`Could not delete note: ${e.message}`)
										}
									}
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
								const newLocalNotes = { ...localNotes }
								const newLocalNote = {
									local_id: uuidv4(),
									title: "",
									body: "",
									updated_at: Math.floor(new Date().getTime()),
									dirty: true,
								} as LocalNote
								newLocalNotes[newLocalNote.local_id] = newLocalNote
								setSelectedNote(newLocalNote.local_id)
								setLocalNotes(newLocalNotes)
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
										// update canvas
										if (!client) {
											return
										}
										if (!address) {
											return
										}

										try {
											await updateNote(currentNote)
											// set the note to clean
											const newLocalNotes = {
												...localNotes,
											}
											newLocalNotes[selectedNote] = {
												...currentNote,
												dirty: false,
											}
											setLocalNotes(newLocalNotes)
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
