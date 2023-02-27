import { v4 as uuidv4 } from "uuid"
import { metamaskDecryptData, metamaskEncryptData, metamaskGetPublicKey } from "./metamaskCrypto"
import nacl from "tweetnacl"
import { Client } from "@canvas-js/hooks"

export type EncryptedNote = {
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

export type LocalNote = {
	id?: string
	updated_at: number

	local_id: string
	key_id: string
	creator_id: string

	title: string
	body: string
	dirty: boolean
}

export type EncryptedKey = {
	id: string
	updated_at: number

	key_id: string
	encrypted_key: string
	owner_id: string
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
	return await metamaskDecryptData(account, Buffer.from(key.encrypted_key, "base64"))
}

export const decryptNote = async (
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

export const encryptNote = async (
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
