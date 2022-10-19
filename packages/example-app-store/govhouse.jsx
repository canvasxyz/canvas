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

export const component = ({ React, routes, actions, useRef, useRoute, useState, useEffect }, { props }) => {
	const { error, data } = useRoute("/cards")
	const [focused, setFocused] = useState(false)
	const [submitting, setSubmitting] = useState(false)
	const inputRef = useRef()

	return (
		<div tabIndex="0" onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
			<div
				className="box has-background-info has-text-white has-text-centered has-text-weight-semibold py-2"
				style={{ borderRadius: 0 }}
			>
				Gov House
			</div>
			{data?.length}
			{data?.map((d) => {
				return (
					<div key={d.id} className="box m-3">
						<div>{d.text}</div>
						<div>{d.creator}</div>
						<div>{d.votes_count}</div>
					</div>
				)
			})}
			<div className="p-3">
				<form
					onSubmit={(e) => {
						e.preventDefault()
						setSubmitting(true)
						actions
							.dispatch("createCard", inputRef.current.value)
							.then(() => setSubmitting(false))
							.catch(() => setSubmitting(false))
					}}
				>
					<input
						className="input"
						type="text"
						ref={inputRef}
						placeholder="Write your opinion here"
						disabled={submitting}
					/>
					<input className="button" type="submit" value="Post" />
				</form>
			</div>
		</div>
	)
}
