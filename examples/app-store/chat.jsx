export const models = {
	messages: {
		id: "string",
		text: "string",
		creator: "string",
		updated_at: "datetime",
		indexes: [],
	},
	reacts: {
		id: "string",
		message_id: "string",
		value: "integer",
		creator: "string",
		updated_at: "datetime",
		indexes: ["message_id"],
	},
}

export const routes = {
	"/messages": `
	SELECT messages.*,
	    group_concat(reacts.creator || ':' || reacts.value, ';') AS reacts
	FROM messages
	LEFT JOIN reacts ON messages.id = reacts.message_id
	GROUP BY messages.id
	ORDER BY updated_at DESC
	`,
}

export const actions = {
	message(text) {
		this.db.messages.set(this.hash, {
			creator: this.from,
			text,
		})
	},
	react(messageId, value) {
		this.db.reacts.set(`${this.from}/${messageId}`, {
			creator: this.from,
			message_id: messageId,
			value: value ? 1 : -1,
		})
	},
}

export const component = ({ react: { useRef, useState }, useRoute, dispatch }) => {
	const { error, data } = useRoute("/messages")
	const [submitting, setSubmitting] = useState(false)
	const inputRef = useRef()

	return (
		<div>
			<div
				className="box has-background-info has-text-white has-text-centered has-text-weight-semibold py-2"
				style={{ borderRadius: 0 }}
			>
				Chat
			</div>
			{data?.length} message{data?.length === 1 ? "" : "s"}
			{data?.map((d) => {
				return (
					<div key={d.id} className="box m-3">
						<div>{d.text}</div>
						<div>{d.creator.slice(2, 6)}</div>
						<div>{d.reacts}</div>
						<button onClick={(e) => dispatch("react", d.id, true)}>+</button>
						<button onClick={(e) => dispatch("react", d.id, false)}>-</button>
					</div>
				)
			})}
			<div className="p-3">
				<form
					onSubmit={(e) => {
						e.preventDefault()
						setSubmitting(true)
						dispatch("message", inputRef.current.value)
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
