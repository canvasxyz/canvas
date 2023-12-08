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
			selected?.topic === topic ? "bg-stone-200" : "bg-stone-300 hover:bg-stone-200 active:bg-white cursor-pointer"
		return (
			<div key={topic} className={`p-2 border-b border-stone-400 ${style} select-none`} onClick={() => select(topic)}>
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
