import React from "react"
import { Canvas } from "@canvas-js/core"
import { useLiveQuery } from "@canvas-js/hooks"
import { models, actions } from "./contract.js"

export const App: React.FC<{ app: Canvas<typeof models, typeof actions> }> = ({ app }) => {
	const [row] = useLiveQuery(app, "counter") ?? []

	return (
		<div className="bg-gray-800 rounded-lg p-6">
			<h2 className="text-xl font-semibold mb-3">Counter</h2>
			
			<div className="flex items-center justify-between">
				<div className="flex items-center">
					<span className="text-gray-400 mr-2">Count:</span>
					<span className="text-3xl font-bold">{row?.count ?? 0}</span>
				</div>
				
				<div className="flex space-x-3">
					<button 
						onClick={() => app.actions.increment()} 
						className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white"
					>
						Increment
					</button>
				</div>
			</div>
		</div>
	)
}
