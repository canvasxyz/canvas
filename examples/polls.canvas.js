export const models = {
	poll: {
		title: "string",
		creator: "string",
		createdAt: "datetime",
		indexes: ["creator", "createdAt"],
	},
	card: {
		pollId: "string",
		text: "string",
		creator: "string",
		createdAt: "datetime",
		indexes: ["pollId"],
	},
	vote: {
		cardId: "string",
		isAgree: "boolean",
		isDisagree: "boolean",
		creator: "string",
		createdAt: "datetime",
		indexes: ["cardId"],
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
	createPoll(title) {
		this.db.poll.create({
			creator: this.from,
			createdAt: this.timestamp,
			title,
		})
	},
	createCard(pollId, text) {
		this.db.card({
			creator: this.from,
			createdAt: this.timestamp,
			pollId,
			text,
		})
	},
	createVote(cardId, value) {
		this.db.vote({
			creator: this.from,
			createdAt: this.timestamp,
			cardId,
			isAgree: value,
			isDisagree: !value,
		})
	},
}
