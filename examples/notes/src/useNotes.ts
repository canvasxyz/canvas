import { v4 as uuidv4 } from "uuid"
import { useEffect, useState } from "react"
import { Client, useRoute } from "@canvas-js/hooks"
import { decryptNote, EncryptedKey, EncryptedNote, encryptNote, LocalNote } from "./EncryptedNote"

export const useNotes = (address: string | null, client: Client | null) => {
	const { data: encryptedNoteData } = useRoute<EncryptedNote>("/encrypted_notes", {})
	const { data: encryptedKeyData } = useRoute<EncryptedKey>("/encrypted_keys", {})

	const [localNotes, setLocalNotes] = useState<Record<string, LocalNote>>({})

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
		// set the note to clean
		updateLocalNote(note.local_id, { dirty: false })
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

	const createNewLocalNote = () => {
		const newLocalNote = {
			local_id: uuidv4(),
			title: "",
			body: "",
			updated_at: Math.floor(new Date().getTime()),
			dirty: true,
		} as LocalNote
		updateLocalNote(newLocalNote.local_id, newLocalNote)
		return newLocalNote
	}

	const deleteNote = async (localKey: string) => {
		if (!client) {
			return
		}

		const currentNote = localNotes[localKey]
		if (!currentNote) {
			return
		}

		// delete from local copy
		const { [localKey]: deletedLocalNote, ...otherLocalNotes } = localNotes
		setLocalNotes(otherLocalNotes)

		// delete on canvas
		if (currentNote.id) {
			await client.deleteNote({ id: currentNote.id })
		}
	}

	return { localNotes, deleteNote, updateNote, updateLocalNote, createNewLocalNote }
}
