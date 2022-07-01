export const models = {
	poll: {
		title: "string",
		creator: "string",
		created_at: "datetime",
		indexes: ["creator", "created_at"],
	},
	card: {
		poll_id: "string",
		text: "string",
		creator: "string",
		created_at: "datetime",
		indexes: ["pollId"],
	},
	vote: {
		card_id: "string",
		is_agree: "boolean",
		is_disagree: "boolean",
		creator: "string",
		indexes: ["cardId"],
	},
}

export const routes = {
	// 	"/polls/:page":
	// 		"SELECT * FROM polls ORDER BY createdAt DESC LIMIT 10 OFFSET (:page * 10)",
	// 	"/cards/:id/:page": `
	// SELECT cards.id, cards.poll_id, cards.text, cards.creator, cards.created_at,
	//     group_concat(votes.creator || ':' || IIF(votes.is_agree, 'true', 'false'), ';') AS votes,
	//     count(votes.id) AS votes_count
	// FROM cards
	// LEFT JOIN votes ON cards.id = votes.card_id
	// WHERE cards.poll_id = :id
	// GROUP BY cards.id
	// ORDER BY votes_count DESC
	// LIMIT 10 OFFSET (:page * 10)
	// `,
}

export const actions = {
	createPoll(title) {
		this.db.poll.set(this.hash, {
			creator: this.from,
			created_at: this.timestamp,
			title,
		})
	},
	createCard(pollId, text) {
		this.db.card.set(this.hash, {
			creator: this.from,
			created_at: this.timestamp,
			poll_id: pollId,
			text,
		})
	},
	createVote(cardId, value) {
		this.db.vote.set(`${this.from}/${cardId}`, {
			creator: this.from,
			card_id: cardId,
			is_agree: value,
			is_disagree: !value,
		})
	},
}
