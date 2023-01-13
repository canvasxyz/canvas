export const models = {
	polls: {
		id: "string",
		title: "string",
		creator: "string",
		updated_at: "datetime",
		indexes: ["creator"],
	},
	cards: {
		id: "string",
		poll_id: "string",
		text: "string",
		creator: "string",
		updated_at: "datetime",
		indexes: ["poll_id"],
	},
	votes: {
		id: "string",
		card_id: "string",
		is_agree: "boolean",
		is_disagree: "boolean",
		creator: "string",
		updated_at: "datetime",
		indexes: ["card_id"],
	},
}

export const routes = {
	"/polls/:page": ({ page = 0 }, { db }) =>
		db.queryRaw("SELECT * FROM polls ORDER BY updated_at DESC LIMIT 10 OFFSET (:page * 10)", { page }),
	"/cards/:id/:page": ({ id, page = 0 }, { db }) =>
		db.queryRaw(
			`SELECT cards.id, cards.poll_id, cards.text, cards.creator, cards.updated_at,
	group_concat(votes.creator || ':' || IIF(votes.is_agree, 'true', 'false'), ';') AS votes,
		count(votes.id) AS votes_count
	FROM cards
	LEFT JOIN votes ON cards.id = votes.card_id
	WHERE cards.poll_id = :id
	GROUP BY cards.id
	ORDER BY votes_count DESC
	LIMIT 10 OFFSET (:page * 10)
	`,
			{ id, page }
		),
}

export const contracts = {
	milady: {
		chain: "eth",
		chainId: "1",
		address: "0x5af0d9827e0c53e4799bb226655a1de152a425a5",
		abi: ["function balanceOf(address owner) view returns (uint balance)"],
	},
}

export const actions = {
	async createPoll({ title }, ctx) {
		const [balance] = await ctx.contracts.milady.balanceOf(ctx.from)
		if (balance === 0) {
			throw new Error("balance is zero")
		}

		ctx.db.polls.set(ctx.hash, {
			creator: ctx.from,
			title,
		})
	},
	async createCard({ pollId, text }, ctx) {
		const [balance] = await ctx.contracts.milady.balanceOf(ctx.from)
		if (balance === 0) {
			throw new Error("balance is zero")
		}

		ctx.db.cards.set(ctx.hash, {
			creator: ctx.from,
			poll_id: pollId,
			text,
		})
	},
	async createVote({ cardId, value }, ctx) {
		const [balance] = await ctx.contracts.milady.balanceOf(ctx.from)
		if (balance === 0) {
			throw new Error("balance is zero")
		}

		ctx.db.votes.set(`${ctx.from}/${cardId}`, {
			creator: ctx.from,
			card_id: cardId,
			is_agree: value,
			is_disagree: !value,
		})
	},
}
