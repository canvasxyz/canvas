import Database from "better-sqlite3"

export function createDatabase(location: string) {
	const db = new Database(location)

	db.exec(`
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

		CREATE TABLE IF NOT EXISTS sessions (
			topic TEXT,
			id TEXT,
			PRIMARY KEY (id)
		);

		CREATE TABLE IF NOT EXISTS actions (
			topic TEXT,
			id TEXT,
			PRIMARY KEY (id)
		);

		CREATE INDEX IF NOT EXISTS sessions_topic_index ON sessions (topic);
    `)

	const addCountsRow = db.prepare(`
    INSERT INTO counts(topic, action_count, session_count)
    VALUES(?, 0, 0);
  `)

	const incrementActionCounts = db.prepare(`
    UPDATE counts
    SET action_count = action_count + 1
    WHERE topic = ?;
  `)

	const incrementSessionCounts = db.prepare(`
    UPDATE counts
    SET session_count = session_count + 1
    WHERE topic = ?;
  `)

	const selectCounts = db.prepare(`SELECT * FROM counts WHERE topic = ?`)
	const selectCountsAll = db.prepare(`SELECT * FROM counts`)
	const selectCountsTotal = db.prepare(
		`SELECT SUM(action_count) as action_count, SUM(session_count) as session_count FROM counts`,
	)

	const addAddress = db.prepare(`
    INSERT INTO addresses(topic, address)
    VALUES (?, ?)
    ON CONFLICT (topic, address)
    DO NOTHING;
  `)

	const selectAddressCount = db.prepare(`SELECT COUNT(*) AS count FROM addresses WHERE topic = ?`)
	const selectAddressCountsAll = db.prepare(`SELECT topic, COUNT(topic) AS count FROM addresses GROUP BY topic`)
	const selectAddressCountTotal = db.prepare(`SELECT COUNT(DISTINCT address) AS count FROM addresses`)

	const addSession = db.prepare(`
		INSERT INTO sessions(topic, id)
		VALUES (?, ?);
	`)

	const selectSessions = db.prepare(`
		SELECT * FROM sessions
		WHERE topic = ? AND id <= ?
		ORDER BY id DESC
		LIMIT ?;
	`)

	const addAction = db.prepare(`
		INSERT INTO actions(topic, id)
		VALUES (?, ?);
	`)

	const selectActions = db.prepare(`
		SELECT * FROM actions
		WHERE topic = ? AND id <= ?
		ORDER BY id DESC
		LIMIT ?;
	`)

	return {
		db,
		queries: {
			addCountsRow,
			incrementActionCounts,
			incrementSessionCounts,
			selectCounts,
			selectCountsAll,
			selectCountsTotal,
			addAddress,
			selectAddressCount,
			selectAddressCountsAll,
			selectAddressCountTotal,
			addSession,
			selectSessions,
			addAction,
			selectActions,
		},
	} as any
}
