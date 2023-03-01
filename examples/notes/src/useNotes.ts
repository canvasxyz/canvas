import { v4 as uuidv4 } from "uuid"
import { useEffect, useState } from "react"
import nacl from "tweetnacl"
import { Client, useRoute } from "@canvas-js/hooks"
import { EncryptedKey, EncryptedNote, LocalNote, User } from "./models"
import { metamaskDecryptData, metamaskEncryptData, metamaskGetPublicKey } from "./metamaskCrypto"

const lookupEncryptedKey = (keys: EncryptedKey[], owner_id: string, note_id: string): EncryptedKey | undefined => {
	for (const key of keys) {
		if (key.note_id == note_id && key.owner_id == owner_id) {
			return key
		}
	}
}

const encryptNoteContent = (key: Uint8Array, content: { body: string; title: string }) => {
	const serializedNoteContent = Buffer.from(JSON.stringify(content), "utf8")
	const nonce = nacl.randomBytes(24)
	const encryptedNoteContent = nacl.secretbox(serializedNoteContent, nonce, key)

	return {
		nonce,
		encryptedNoteContent,
	}
}

async function syncNotes(
	address: string,
	encryptedNoteData: EncryptedNote[],
	encryptedKeyData: EncryptedKey[],
	localNotes: Record<string, LocalNote>
): Promise<Record<string, LocalNote>> {
	if (address == null || encryptedKeyData == null) {
		console.log(`address=${address} encryptedKeyData=${encryptedKeyData}`)
		return {}
	}
	// find the notes that need to be updated
	const newLocalNotes: Record<string, LocalNote> = {}
	for (const encryptedNote of encryptedNoteData || []) {
		const existingLocalNote = localNotes[encryptedNote.local_id]
		if (existingLocalNote && !existingLocalNote.dirty) {
			// use existing note
			newLocalNotes[encryptedNote.local_id] = existingLocalNote
		} else {
			// otherwise use downloaded note
			// look up key
			// look up the note's encryption key
			const encryptedKey = lookupEncryptedKey(encryptedKeyData || [], address, encryptedNote.id)
			if (!encryptedKey) {
				continue
			}
			// decrypt it
			const key = await metamaskDecryptData(address, Buffer.from(encryptedKey.encrypted_key, "base64"))
			const nonceB = Buffer.from(encryptedNote.nonce, "base64")
			const data = nacl.secretbox.open(Buffer.from(encryptedNote.encrypted_content, "base64"), nonceB, key)

			if (!data) {
				continue
			}

			// use the note's key to decrypt the note data
			const decryptedContent = Buffer.from(data).toString("utf8")
			const { body, title } = JSON.parse(decryptedContent)
			newLocalNotes[encryptedNote.local_id] = {
				body,
				title,
				local_id: encryptedNote.local_id,
				creator_id: encryptedNote.creator_id,
				updated_at: encryptedNote.updated_at,
				encrypted_key: encryptedKey.encrypted_key,
				id: encryptedNote.id,
				dirty: false,
			}
		}
	}
	return newLocalNotes
}

export const useNotes = (address: string | null, client: Client | null) => {
	const { data: encryptedNoteData } = useRoute<EncryptedNote>("/encrypted_notes", {})
	const { data: encryptedKeyData } = useRoute<EncryptedKey>("/encrypted_keys", {})

	const [localNotes, setLocalNotes] = useState<Record<string, LocalNote>>({})

	useEffect(() => {
		if (address == null || encryptedNoteData == null || encryptedKeyData == null) {
			return
		}
		if (!client) {
			setLocalNotes({})
		} else {
			syncNotes(address, encryptedNoteData, encryptedKeyData, localNotes).then((newLocalNotes) => {
				setLocalNotes(newLocalNotes)
			})
		}
	}, [client, address, encryptedKeyData, encryptedNoteData])

	const createNote = async () => {
		if (!address || !client) {
			return
		}

		// generate a new key
		const pubKey = await metamaskGetPublicKey(address)
		const noteKey = nacl.randomBytes(32)

		const localId = uuidv4()

		const content = { body: "", title: "" }

		const { nonce, encryptedNoteContent } = encryptNoteContent(noteKey, content)
		await client.createNote({
			encrypted_key: metamaskEncryptData(pubKey, Buffer.from(noteKey)).toString("base64"),
			local_id: localId,
			encrypted_content: Buffer.from(encryptedNoteContent).toString("base64"),
			nonce: Buffer.from(nonce).toString("base64"),
		})

		return localId
	}

	const updateNote = async (note: LocalNote) => {
		if (!client || !address) {
			return
		}

		const content = { body: note.body, title: note.title }

		const noteKey = await metamaskDecryptData(address, Buffer.from(note.encrypted_key, "base64"))
		const { nonce, encryptedNoteContent } = encryptNoteContent(noteKey, content)
		await client.updateNote({
			id: note.id,
			local_id: note.local_id,
			encrypted_content: Buffer.from(encryptedNoteContent).toString("base64"),
			nonce: Buffer.from(nonce).toString("base64"),
		})

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

	const deleteNote = async (noteId: string) => {
		if (!client || !address) {
			return
		}

		// delete on canvas
		await client.deleteNote({ id: noteId })
	}

	return { localNotes, createNote, deleteNote, updateNote, updateLocalNote }
}
