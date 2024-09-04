import { Client, QueryResult } from "pg"

// Define interfaces for the return types
interface Count {
	topic: string
	action_count: number
	session_count: number
}

interface Message {
	topic: string
	id: string
	type: string
}

interface CountTotal {
	action_count: string
	session_count: string
}

interface AddressCount {
	count: string
}

export async function createDatabase(client: Client) {
	await client.query(`
		CREATE TABLE IF NOT EXISTS counts (
			topic TEXT PRIMARY KEY,
			action_count INTEGER,
			session_count INTEGER
		);

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
	`)

	return {
		addCountsRow: async (topic: string) => {
			return await client.query(
				`
				INSERT INTO counts(topic, action_count, session_count)
				VALUES($1, 0, 0)
				ON CONFLICT (topic) DO NOTHING;
			`,
				[topic],
			)
		},

		incrementActionCounts: async (topic: string) => {
			return await client.query(
				`
				UPDATE counts
				SET action_count = action_count + 1
				WHERE topic = $1;
			`,
				[topic],
			)
		},

		incrementSessionCounts: async (topic: string) => {
			return await client.query(
				`
				UPDATE counts
				SET session_count = session_count + 1
				WHERE topic = $1;
			`,
				[topic],
			)
		},

		selectCounts: async (topic: string): Promise<QueryResult<Count>> => {
			return await client.query<Count>("SELECT * FROM counts WHERE topic = $1", [topic])
		},

		selectCountsAll: async (): Promise<QueryResult<Count>> => {
			return await client.query<Count>("SELECT * FROM counts")
		},

		selectCountsTotal: async (): Promise<QueryResult<CountTotal>> => {
			return await client.query<CountTotal>(
				"SELECT SUM(action_count) as action_count, SUM(session_count) as session_count FROM counts",
			)
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
			return await client.query<AddressCount>("SELECT COUNT(*) AS count FROM addresses WHERE topic = $1", [topic])
		},

		selectAddressCountsAll: async (): Promise<QueryResult<{ topic: string; count: string }>> => {
			return await client.query<{ topic: string; count: string }>(
				"SELECT topic, COUNT(topic) AS count FROM addresses GROUP BY topic",
			)
		},

		selectAddressCountTotal: async (): Promise<QueryResult<AddressCount>> => {
			return await client.query<AddressCount>("SELECT COUNT(DISTINCT address) AS count FROM addresses")
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

		selectMessages: async (
			topic: string,
			id: string,
			type: string | null,
			limit: number,
		): Promise<QueryResult<Message>> => {
			return await client.query<Message>(
				`
				SELECT * FROM messages
				WHERE topic = $1 AND id <= $2 AND ($3::text IS NULL OR type = $3)
				ORDER BY id DESC
				LIMIT $4;
			`,
				[topic, id, type, limit],
			)
		},

		selectMessagesNoLimit: async (topic: string, id: string, type: string | null): Promise<QueryResult<Message>> => {
			return await client.query<Message>(
				`
				SELECT * FROM messages
				WHERE topic = $1 AND id <= $2 AND ($3::text IS NULL OR type = $3)
				ORDER BY id DESC;
			`,
				[topic, id, type],
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
