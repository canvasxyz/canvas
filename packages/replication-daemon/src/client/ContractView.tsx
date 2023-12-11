import React, { useCallback, useContext, useEffect } from "react"

import { AppContext } from "./AppContext.js"
import { Editor } from "./Editor.js"
import { EditorState } from "@codemirror/state"

export const ContractView: React.FC<{ topic: string; contract: string }> = ({ topic, contract }) => {
	const { state } = useContext(AppContext)
	const { status = "stopped" } = state?.apps.find((app) => app.topic === topic) ?? {}

	useEffect(() => {
		//
	}, [status])

	const start = useCallback(async () => {
		const res = await fetch(`/api/apps/${topic}/start`, { method: "post" })
		if (res.status !== 200) {
			const message = await res.text()
			alert(`failed to start app (${res.status} ${res.statusText}) ${message}`)
		}
	}, [topic])

	const stop = useCallback(async () => {
		// const res = await fetch(`/api/apps/${topic}/stop`, { method: "post" })
		// if (res.status !== 200) {
		// 	const message = await res.text()
		// 	alert(`failed to stop app (${res.status} ${res.statusText}) ${message}`)
		// }
	}, [topic])

	const startButtonStyle =
		status === "started"
			? "bg-gray-100 cursor-not-allowed"
			: "bg-green-100 hover:border-gray-300 active:bg-white cursor-pointer"

	// const stopButtonStyle =
	// 	status === "stopped"
	// 		? "bg-gray-100 cursor-not-allowed"
	// 		: "bg-red-200 hover:bg-red-100 active:bg-white cursor-pointer"

	const handleChange = useCallback((state: EditorState) => {
		//
	}, [])

	return (
		<div className="h-full p-2 flex flex-col gap-2">
			<div>
				<code className="break-word">{topic}</code>
			</div>
			<div className="flex gap-2">
				<button
					key="start"
					className={`py-2 px-8 border rounded ${startButtonStyle}`}
					onClick={() => start()}
					disabled={status === "started"}
				>
					Start
				</button>

				{/* <button
					key="stop"
					className={`py-2 px-8 border rounded ${stopButtonStyle}`}
					onClick={() => stop()}
					// disabled={status === "stopped"}
					disabled={true}
				>
					Stop
				</button> */}
			</div>
			<div className="flex-1">
				<Editor
					key={`${topic}/${status}`}
					initialValue={contract}
					readOnly={status === "started"}
					onChange={handleChange}
				/>
			</div>
		</div>
	)
}
