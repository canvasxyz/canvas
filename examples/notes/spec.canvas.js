export const models = {
	encrypted_notes: {
		id: "string",
		updated_at: "datetime",
		indexes: ["updated_at"],
		// used by the UI when creating new notes
		local_id: "string",
		// see keys(id)
		// the id of the key used to encrypt this note
		key_id: "string",
		// this stores the actual content of the note
		// this should be a base64-encoded string
		encrypted_body: "string",
		// nonsense value used when encrypting the encrypted_body
		nonce: "string",
		// the id of the user that created it
		// users(id)
		creator_id: "string",
	},
	encrypted_keys: {
		id: "string",
		updated_at: "datetime",
		indexes: ["updated_at", "owner_id"],
		// the id of the underlying decrypted key
		// there may be multiple encrypted_keys entries if a note
		// is shared with more than one user
		key_id: "string",
		// the actual encrypted key
		// this is encrypted using the owner's public key
		// once decrypted, this can be used to encrypt notes
		// it is a symmetric key
		// this should be a base64-encoded string
		encrypted_key: "string",
		// the id of the user it belongs to
		// users(id)
		owner_id: "string",
	},
	users: {
		id: "string",
		updated_at: "datetime",
		// the ethereum address of a user
		address: "string",
		// the user's public key
		// we can derive address from pub_key, but not pub_key from address
		// so a user has to first upload their pub_key in order for other users
		// to be able to share notes with them
		pub_key: "string",
	},
}

export const routes = {
	"/encrypted_notes": ({}, { db }) => db.queryRaw("SELECT * from encrypted_notes"),
	"/encrypted_keys": ({}, { db }) => db.queryRaw("SELECT * from encrypted_keys"),
	"/users": ({}, { db }) => db.queryRaw("SELECT * from users"),
}

export const actions = {
	deleteNote({ id }, { db, from }) {
		const recoveredFrom = id.split("/")[0]
		if (recoveredFrom !== from) {
			// user is trying to delete a note created by a different user
			return false
		}
		db.encrypted_notes.delete(id)
	},
	updateNote({ id, encrypted_body, nonce, key_id, local_id }, { db, from, hash }) {
		let key
		if (id) {
			const recoveredFrom = id.split("/")[0]
			if (recoveredFrom !== from) {
				// user is trying to update a note created by a different user
				return false
			}
			key = id
		} else {
			key = `${from}/${hash}`
		}
		db.encrypted_notes.set(key, { local_id, encrypted_body, nonce, key_id, creator_id: from })
	},
	uploadKey({ key_id, encrypted_key, owner_id }, { db, hash }) {
		db.encrypted_keys.set(hash, { key_id, encrypted_key, owner_id })
	},
	register({ pub_key }, { db, from }) {
		// check that the public key matches their eth address
		const derivedAddress = ethersComputeAddress(pub_key)
		if (derivedAddress !== pub_key) {
			return false
		}
		db.users.set(`from:${from}`, { address: from, pub_key })
	},
	unregister({}, { db, from }) {
		// user removes their public key
		// this removes them from the list of users that notes can be shared with
		db.users.del(`from:${from}`)
	},
}

// TODO: implement encryption
// TODO: could we make encrypted_notes, encrypted_keys and users separate contracts?
// encrypted_notes -> encrypted_keys, users
// encrypted_keys -> users
