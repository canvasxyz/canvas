export const database = "sqlite"

export const models = {
	polls: {
		title: "string",
		creator: "string",
		created_at: "datetime",
		indexes: ["creator", "created_at"],
	},
	cards: {
		poll_id: "string",
		text: "string",
		creator: "string",
		created_at: "datetime",
		indexes: ["poll_id"],
	},
	votes: {
		card_id: "string",
		is_agree: "boolean",
		is_disagree: "boolean",
		creator: "string",
		indexes: ["card_id"],
	},
}

export const routes = {
	"/polls/:page": "SELECT * FROM polls ORDER BY created_at DESC LIMIT 10 OFFSET (:page * 10)",
	"/cards/:id/:page": `
	SELECT cards.id, cards.poll_id, cards.text, cards.creator, cards.created_at,
	    group_concat(votes.creator || ':' || IIF(votes.is_agree, 'true', 'false'), ';') AS votes,
	    count(votes.id) AS votes_count
	FROM cards
	LEFT JOIN votes ON cards.id = votes.card_id
	WHERE cards.poll_id = :id
	GROUP BY cards.id
	ORDER BY votes_count DESC
	LIMIT 10 OFFSET (:page * 10)
	`,
}

export const contracts = {
	milady: {
		chain: "eth",
		chainId: 1,
		address: "0x5af0d9827e0c53e4799bb226655a1de152a425a5",
		abi: ["function balanceOf(address owner) view returns (uint balance)"],
	},
}

export const actions = {
	async createPoll(title) {
		if ((await contract("milady").balanceOf(this.from)) === "0") return false
		this.db.polls.set(this.hash, {
			creator: this.from,
			created_at: this.timestamp,
			title,
		})
	},
	async createCard(pollId, text) {
		if ((await contract.milady.balanceOf(this.from)) === "0") return false
		this.db.cards.set(this.hash, {
			creator: this.from,
			created_at: this.timestamp,
			poll_id: pollId,
			text,
		})
	},
	async createVote(cardId, value) {
		if ((await contract.milady.balanceOf(this.from)) === "0") return false
		this.db.votes.set(`${this.from}/${cardId}`, {
			creator: this.from,
			card_id: cardId,
			is_agree: value,
			is_disagree: !value,
		})
	},
}
