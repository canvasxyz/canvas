export const models = {
	poll: {
		title: "string",
		creator: "string",
		createdAt: "datetime",
	},
	card: {
		pollId: "@poll",
		text: "string",
		creator: "string",
		createdAt: "datetime",
	},
	vote: {
		cardId: "@card",
		isAgree: "boolean",
		isDisagree: "boolean",
		creator: "string",
		createdAt: "datetime",
	},
}

export const routes = {
	// 	"/polls/:page":
	// 		"SELECT * FROM polls ORDER BY createdAt DESC LIMIT 10 OFFSET (:page * 10)",
	// 	"/cards/:id/:page": `
	// SELECT cards.id, cards.pollId, cards.text, cards.creator, cards.createdAt,
	//     group_concat(votes.creator || ':' || IIF(votes.isAgree, 'true', 'false'), ';') AS votes,
	//     count(votes.id) AS votes_count
	// FROM cards
	// LEFT JOIN votes ON cards.id = votes.cardId
	// WHERE cards.pollId = :id
	// GROUP BY cards.id
	// ORDER BY votes_count DESC
	// LIMIT 10 OFFSET (:page * 10
	// `,
}

export const actions = {
	createPoll: {
		args: { title: "string" },
		handler({ db }, { from, timestamp, args: { title } }) {
			db.poll({ creator: from, createdAt: timestamp, title })
		},
	},

	createCard: {
		args: { pollId: "@poll", text: "string" },
		handler({ db }, { from, timestamp, args: { pollId, text } }) {
			db.card({ creator: from, createdAt: timestamp, pollId, text })
		},
	},

	createVote: {
		args: { cardId: "@card", value: "boolean" },
		handler({ db }, { from, timestamp, args: { cardId, value } }) {
			db.vote({
				creator: from,
				createdAt: timestamp,
				cardId,
				isAgree: value,
				isDisagree: !value,
			})
		},
	},
}
