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
	localNotes: Record<string, LocalNote>,
	noteKeys: Record<string, { decrypted_key: Buffer; encrypted_key: string }>
): Promise<Record<string, LocalNote>> {
	if (address == null) {
		console.log(`address=${address}`)
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
			const key = noteKeys[encryptedNote.id]
			if (!key) {
				continue
			}
			// decrypt it
			const nonceB = Buffer.from(encryptedNote.nonce, "base64")
			const data = nacl.secretbox.open(
				Buffer.from(encryptedNote.encrypted_content, "base64"),
				nonceB,
				key.decrypted_key
			)

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
				encrypted_key: key.encrypted_key,
				id: encryptedNote.id,
				dirty: false,
			}
		}
	}
	return newLocalNotes
}

const entriesToMap = <T>(entries: { key: string; value: T }[]): Record<string, T> => {
	const res: Record<string, T> = {}
	for (const { key, value } of entries) {
		res[key] = value
	}
	return res
}

export const useNoteKeys = (address: string | null) => {
	const [noteKeys, setNoteKeys] = useState<Record<string, { decrypted_key: Buffer; encrypted_key: string }>>({})
	const { data: encryptedKeyData } = useRoute<EncryptedKey>("/encrypted_keys", {})

	useEffect(() => {
		if (address == null || encryptedKeyData == null) {
			console.log("setting noteKeys to {}")
			setNoteKeys({})
			return
		}
		const decryptKeyPromises: Promise<{ key: string; value: { decrypted_key: Buffer; encrypted_key: string } }>[] = []
		for (const encryptedKey of encryptedKeyData) {
			console.log(`${encryptedKey.owner_id}, ${address}`)
			if (encryptedKey.owner_id == address) {
				if (encryptedKey.note_id in noteKeys) {
					const promiseFunc_ = async () => {
						return { key: encryptedKey.note_id, value: noteKeys[encryptedKey.note_id] }
					}
					decryptKeyPromises.push(promiseFunc_())
				} else {
					console.log(`going to decrypt ${encryptedKey.note_id} ${encryptedKey.encrypted_key}`)
					const promiseFunc = async () => {
						const decryptedKey = await metamaskDecryptData(address, Buffer.from(encryptedKey.encrypted_key, "base64"))
						return {
							key: encryptedKey.note_id,
							value: { decrypted_key: decryptedKey, encrypted_key: encryptedKey.encrypted_key },
						}
					}
					decryptKeyPromises.push(promiseFunc())
				}
			}
		}
		Promise.all(decryptKeyPromises).then((decryptedKeys) => {
			setNoteKeys(entriesToMap(decryptedKeys))
		})
	}, [address, encryptedKeyData])

	return { noteKeys }
}

const usePubKey = (address: string | null) => {
	const [pubKey, setPubKey] = useState<Buffer | null>(null)

	useEffect(() => {
		// if address changes, invalidate pubkey cache
		setPubKey(null)
	}, [address])

	const getPubKey = async () => {
		if (address == null) {
			throw Error("public key requested but user is not logged in!")
		}
		if (pubKey) {
			return pubKey
		}
		const retrievedPubKey = await metamaskGetPublicKey(address)
		setPubKey(retrievedPubKey)
		return retrievedPubKey
	}

	return { getPubKey }
}

export const useNotes = (
	address: string | null,
	client: Client | null,
	noteKeys: Record<string, { decrypted_key: Buffer; encrypted_key: string }>
) => {
	const { data: encryptedNoteData } = useRoute<EncryptedNote>("/encrypted_notes", {})
	const { data: usersData } = useRoute<User>("/users", {})

	const [localNotes, setLocalNotes] = useState<Record<string, LocalNote>>({})

	const { getPubKey } = usePubKey(address)
	const [pendingPubKey, setPendingPubKey] = useState(false)

	useEffect(() => {
		if (client !== null && usersData !== null && address !== null) {
			let existingUser: User | null = null
			for (const user of usersData) {
				if (user.address == address) {
					existingUser = user
				}
			}
			if (existingUser == null && !pendingPubKey) {
				// prompt for public key
				setPendingPubKey(true)
				try {
					getPubKey().then((pubKey) => {
						if (pubKey) {
							client.register({ pub_key: `0x${pubKey.toString("hex")}` })
						}
					})
				} finally {
					setPendingPubKey(false)
				}
			}
		}
	}, [client, usersData])

	useEffect(() => {
		if (address == null || encryptedNoteData == null || noteKeys == null) {
			return
		}
		if (!client) {
			setLocalNotes({})
		} else {
			syncNotes(address, encryptedNoteData, localNotes, noteKeys).then((newLocalNotes) => {
				setLocalNotes(newLocalNotes)
			})
		}
	}, [client, address, noteKeys, encryptedNoteData])

	const createNote = async () => {
		if (!address || !client) {
			return
		}

		// generate a new key
		const pubKey = await getPubKey()
		if (!pubKey) {
			throw Error("Cannot create note - user did not grant access to public key")
		}

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

		console.log(noteKeys)
		const noteKey = noteKeys[note.id].decrypted_key
		const { nonce, encryptedNoteContent } = encryptNoteContent(noteKey, content)
		updateLocalNote(note.local_id, { dirty: false })

		await client.updateNote({
			id: note.id,
			local_id: note.local_id,
			encrypted_content: Buffer.from(encryptedNoteContent).toString("base64"),
			nonce: Buffer.from(nonce).toString("base64"),
		})
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

	const shareNote = async (otherUser: User, note: LocalNote) => {
		const noteKey = noteKeys[note.id]
		if (!noteKey || client == null) {
			return
		}

		// encrypt the key with the other user's public key
		console.log(otherUser.pub_key)
		const pubKey = Buffer.from(otherUser.pub_key.slice(2), "hex")
		console.log("other user's pubKey:")
		console.log(pubKey)
		console.log(pubKey.length)
		const encryptedKeyRaw = metamaskEncryptData(pubKey, noteKey.decrypted_key)

		await client.shareNote({
			note_id: note.id,
			encrypted_key: encryptedKeyRaw.toString("base64"),
			other_user_id: otherUser.id,
		})
	}

	return { localNotes, createNote, deleteNote, shareNote, updateNote, updateLocalNote, users: usersData || {} }
}
