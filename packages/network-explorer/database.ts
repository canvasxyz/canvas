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
    `)

	const incrementActionCounts = db.prepare(`
    INSERT INTO counts(topic, action_count, session_count)
    VALUES (?, 1, 0)
    ON CONFLICT (topic)
    DO UPDATE SET action_count=action_count+1;
  `)

	const incrementSessionCounts = db.prepare(`
    INSERT INTO counts(topic, action_count, session_count)
    VALUES (?, 0, 1)
    ON CONFLICT (topic)
    DO UPDATE SET session_count=session_count+1;
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

	return {
		db,
		queries: {
			incrementActionCounts,
			incrementSessionCounts,
			selectCounts,
			selectCountsAll,
			selectCountsTotal,
			addAddress,
			selectAddressCount,
			selectAddressCountsAll,
			selectAddressCountTotal,
		},
	}
}
