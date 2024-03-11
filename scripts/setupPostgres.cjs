// set up postgres databases for tests

const { Client } = require("pg")

const pgclient = new Client({
	host: process.env.POSTGRES_HOST,
	port: process.env.POSTGRES_PORT,
	user: "postgres",
	password: "postgres",
	database: "postgres",
})

pgclient.connect()

pgclient.query("CREATE DATABASE test", (err, res) => {
	if (err) throw err
	pgclient.query("CREATE DATABASE test2", (err2, res2) => {
		if (err2) throw err2
		pgclient.query("CREATE DATABASE test3", (err3, res3) => {
			if (err3) throw err3
			pgclient.end()
		})
	})
})
