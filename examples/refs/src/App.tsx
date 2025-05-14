import React from "react"
import { Canvas } from "@canvas-js/core"
import { useLiveQuery } from "@canvas-js/hooks"

import type { T } from "./refs.js"

export const App: React.FC<{ app: T }> = ({ app }) => {
	const refs = useLiveQuery(app, "ref") ?? []

	return (
		<div className="bg-gray-800 rounded-lg p-6">
			<h2 className="text-xl font-semibold mb-3">Counter</h2>

			<div className="flex items-center justify-between">
				<div className="flex items-center">
					{refs.map((ref) => {
						return <div>Ref</div>
					})}
				</div>

				<div className="flex space-x-3">
					<button
						onClick={async () => {
							const item = {}
							app.actions.createRef(item)
						}}
						className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white"
					>
						Increment
					</button>
				</div>
			</div>
		</div>
	)
}
