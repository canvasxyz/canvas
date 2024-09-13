import { Client, QueryResult } from "pg"

// Define interfaces for the return types
interface Count {
	topic: string
	type: string
	count: number
}

interface Message {
	topic: string
	id: string
	type: string
}

interface AddressCount {
	count: string
}

export async function createDatabase(client: Client) {
	await client.query(`
		CREATE TABLE IF NOT EXISTS addresses (
			topic TEXT,
			address TEXT,
			PRIMARY KEY (topic, address)
		);

		CREATE TABLE IF NOT EXISTS messages (
			topic TEXT,
			id TEXT,
			type TEXT,
			PRIMARY KEY (id)
		);

		CREATE INDEX IF NOT EXISTS messages_type_index ON messages (type);
		CREATE INDEX IF NOT EXISTS messages_topic_index ON messages (topic);
		CREATE INDEX IF NOT EXISTS messages_topic_type_index ON messages (topic, type);
	`)

	return {
		selectCounts: async (topic: string): Promise<QueryResult<Count>> => {
			return await client.query<Count>(
				"SELECT topic, type, COUNT(*)::int FROM messages WHERE topic = $1 GROUP BY topic, type;",
				[topic],
			)
		},

		selectCountsAll: async (): Promise<QueryResult<Count>> => {
			return await client.query<Count>("SELECT topic, type, COUNT(*)::int FROM messages GROUP BY topic, type;")
		},

		selectCountsForTypeTotal: async (type: string): Promise<QueryResult<{ count: number }>> => {
			return await client.query<{ count: number }>("SELECT COUNT(*)::int AS count FROM messages WHERE type = $1", [
				type,
			])
		},

		addAddress: async (topic: string, address: string) => {
			return await client.query(
				`
				INSERT INTO addresses(topic, address)
				VALUES ($1, $2)
				ON CONFLICT (topic, address)
				DO NOTHING;
			`,
				[topic, address],
			)
		},

		selectAddressCount: async (topic: string): Promise<QueryResult<AddressCount>> => {
			return await client.query<AddressCount>("SELECT COUNT(*)::int AS count FROM addresses WHERE topic = $1", [topic])
		},

		selectAddressCountsAll: async (): Promise<QueryResult<{ topic: string; count: string }>> => {
			return await client.query<{ topic: string; count: string }>(
				"SELECT topic, COUNT(topic)::int AS count FROM addresses GROUP BY topic",
			)
		},

		selectAddressCountTotal: async (): Promise<QueryResult<AddressCount>> => {
			return await client.query<AddressCount>("SELECT COUNT(DISTINCT address)::int AS count FROM addresses")
		},

		addSession: async (topic: string, id: string) => {
			return await client.query(
				`
				INSERT INTO messages(topic, type, id)
				VALUES ($1, 'session', $2)
				ON CONFLICT (id) DO NOTHING;
			`,
				[topic, id],
			)
		},

		addAction: async (topic: string, id: string) => {
			return await client.query(
				`
				INSERT INTO messages(topic, type, id)
				VALUES ($1, 'action', $2)
				ON CONFLICT (id) DO NOTHING;
			`,
				[topic, id],
			)
		},

		selectMessages: async (topic: string, id: string, type: string, limit: number): Promise<QueryResult<Message>> => {
			return await client.query<Message>(
				`
				SELECT * FROM messages
				WHERE topic = $1 AND id <= $2 AND type = $3
				ORDER BY id DESC
				LIMIT $4;
			`,
				[topic, id, type, limit],
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
