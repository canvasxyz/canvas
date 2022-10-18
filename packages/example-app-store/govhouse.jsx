export const models = {
	cards: {
		id: "string",
		text: "string",
		creator: "string",
		updated_at: "datetime",
		indexes: [],
	},
	votes: {
		id: "string",
		card_id: "string",
		is_agree: "boolean",
		creator: "string",
		updated_at: "datetime",
		indexes: ["card_id"],
	},
}

export const routes = {
	"/cards": `
	SELECT cards.*,
	    group_concat(votes.creator || ':' || IIF(votes.is_agree, 'true', 'false'), ';') AS votes,
	    count(votes.id) AS votes_count
	FROM cards
	LEFT JOIN votes ON cards.id = votes.card_id
	GROUP BY cards.id
	ORDER BY votes_count DESC
	`,
}

export const actions = {
	createCard(pollId, text) {
		this.db.cards.set(this.hash, {
			creator: this.from,
			text,
		})
	},
	createVote(cardId, value) {
		this.db.votes.set(`${this.from}/${cardId}`, {
			creator: this.from,
			card_id: cardId,
			is_agree: value === true,
		})
	},
}

export const component = ({ React, routes, actions, useRef, useState, useEffect }, { props }) => {
	const [focused, setFocused] = useState(false)
	const inputRef = useRef()

	return (
		<div tabIndex="0" onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
			<div>Gov House</div>

			<form
				onSubmit={(e) => {
					e.preventDefault()
					actions.dispatch("createCard")
				}}
			>
				<input type="text" ref={inputRef} placeholder="Write your opinion here" />
			</form>
		</div>
	)
}
