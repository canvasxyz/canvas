import { Client, QueryResult } from "pg"

// Define interfaces for the return types
interface Count {
	type: string
	count: number
}

interface Message {
	id: string
	type: string
}

interface AddressCount {
	count: string
}

export async function createDatabase(client: Client) {
	await client.query(`
		CREATE TABLE IF NOT EXISTS addresses (
			address TEXT,
			PRIMARY KEY (address)
		);

		CREATE TABLE IF NOT EXISTS messages (
			id TEXT,
			type TEXT,
			PRIMARY KEY (id)
		);

		CREATE INDEX IF NOT EXISTS messages_type_index ON messages (type);
	`)

	return {
		selectCounts: async (): Promise<QueryResult<Count>> => {
			return await client.query<Count>("SELECT type, COUNT(*)::int FROM messages GROUP BY type;")
		},

		addAddress: async (address: string) => {
			return await client.query(
				`
				INSERT INTO addresses(address)
				VALUES ($1)
				ON CONFLICT (address)
				DO NOTHING;
			`,
				[address],
			)
		},

		selectAddressCount: async (): Promise<QueryResult<AddressCount>> => {
			return await client.query<AddressCount>("SELECT COUNT(*)::int AS count FROM addresses", [])
		},

		addSession: async (id: string) => {
			return await client.query(
				`
				INSERT INTO messages(type, id)
				VALUES ('session', $1)
				ON CONFLICT (id) DO NOTHING;
			`,
				[id],
			)
		},

		addAction: async (id: string) => {
			return await client.query(
				`
				INSERT INTO messages(type, id)
				VALUES ('action', $1)
				ON CONFLICT (id) DO NOTHING;
			`,
				[id],
			)
		},

		selectMessages: async (id: string, type: "action" | "session", limit: number): Promise<QueryResult<Message>> => {
			return await client.query<Message>(
				`
				SELECT * FROM messages
				WHERE id <= $1 AND ($2::text IS NULL OR type = $2)
				ORDER BY id DESC
				LIMIT $3;
			`,
				[id, type, limit],
			)
		},

		selectAllMessages: async (id: string, limit: number): Promise<QueryResult<Message>> => {
			return await client.query<Message>(
				`
				SELECT * FROM messages
				WHERE id <= $1
				ORDER BY id DESC
				LIMIT $2;
			`,
				[id, limit],
			)
		},
	}
}
