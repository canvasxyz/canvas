import React, { useContext } from "react"

import { AppContext } from "./AppContext.js"

const statusIcons = {
	started: "🟢",
	stopped: "🔴",
}

export const AppList: React.FC<{}> = ({}) => {
	const { state, selected, select } = useContext(AppContext)
	if (state === null) {
		return null
	}

	return state.apps.map(({ topic, status }) => {
		const style =
			selected?.topic === topic ? "bg-stone-100" : "bg-stone-200 hover:bg-stone-100 active:bg-white cursor-pointer"
		return (
			<div key={topic} className={`p-2 border-b border-stone-300 ${style} select-none`} onClick={() => select(topic)}>
				<div>
					<code className="text-sm break-all">{topic}</code>
				</div>
				<div>
					{statusIcons[status]} {status}
				</div>
			</div>
		)
	})
}
