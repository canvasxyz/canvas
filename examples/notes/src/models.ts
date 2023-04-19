// Models from the contract

export type EncryptedNote = {
	updated_at: number
} & EncryptedNoteFields

type EncryptedNoteFields = {
	id: string

	local_id: string
	encrypted_content: string
	creator_id: string
	nonce: string
}

export type EncryptedKey = {
	id: string
	updated_at: number

	note_id: string
	encrypted_key: string
	owner_id: string
}

// The type used for representing the state of the notes locally

export type LocalNote = {
	id: string
	updated_at: number

	local_id: string
	creator_id: string

	// the key that was used to encrypt the note
	encrypted_key: string

	title: string
	body: string
	dirty: boolean
}

export type User = {
	id: string
	updated_at: number
	address: string
	pub_key: string
}
