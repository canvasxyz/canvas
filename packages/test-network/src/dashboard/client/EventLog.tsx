import React, { useState } from "react"
import { Event } from "../shared/types.js"

export const EventLog: React.FC<{ events: Event[] }> = ({ events }) => {
	const [visible, setVisible] = useState(false)

	if (visible) {
		return (
			<>
				<button onClick={() => setVisible(false)}>hide event log</button>
				<pre>
					{events.map((event, index) => {
						if (event === null) {
							return null
						}

						const { type, id, t, detail } = event
						const time = new Date(t).toISOString().slice(11, -1)
						return (
							<div key={index}>
								<code>
									[{time}] [{id}] {type} {JSON.stringify(detail, null, "  ")}
								</code>
							</div>
						)
					})}
				</pre>
			</>
		)
	} else {
		return <button onClick={() => setVisible(true)}>show event log</button>
	}
}
