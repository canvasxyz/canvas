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
		value: "integer",
		creator: "string",
		updated_at: "datetime",
		indexes: ["card_id"],
	},
}

export const routes = {
	"/cards": `
	SELECT cards.*,
	    group_concat(votes.creator || ':' || votes.value, ';') AS votes,
	    SUM(value) AS score
	FROM cards
	LEFT JOIN votes ON cards.id = votes.card_id
	GROUP BY cards.id
	ORDER BY score DESC
	`,
}

export const actions = {
	createCard(text) {
		this.db.cards.set(this.hash, {
			creator: this.from,
			text,
		})
	},
	createVote(cardId, value) {
		this.db.votes.set(`${this.from}/${cardId}`, {
			creator: this.from,
			card_id: cardId,
			value: value ? 1 : -1,
		})
	},
}

export const component = ({ React, dispatch, useRef, useRoute, useState, useEffect }) => {
	const { error, data } = useRoute("/cards")
	const [submitting, setSubmitting] = useState(false)
	const inputRef = useRef()

	return (
		<div>
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
						<div>{d.score}</div>
						<div>{d.votes}</div>
						<button onClick={(e) => dispatch("createVote", d.id, true)}>+</button>
						<button onClick={(e) => dispatch("createVote", d.id, false)}>-</button>
					</div>
				)
			})}
			<div className="p-3">
				<form
					onSubmit={(e) => {
						e.preventDefault()
						setSubmitting(true)
						dispatch("createCard", inputRef.current.value)
							.then(() => {
								inputRef.current.value = ""
								setSubmitting(false)
							})
							.catch(() => setSubmitting(false))
					}}
				>
					<input
						className="input"
						type="text"
						ref={inputRef}
						placeholder="Write something here"
						disabled={submitting}
					/>
					<input className="button" type="submit" value="Post" />
				</form>
			</div>
		</div>
	)
}
