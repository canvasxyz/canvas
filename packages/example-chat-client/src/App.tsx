import React from "react"
import { Connect } from "./Connect"

import { useCanvas } from "@canvas-js/hooks"

import { ErrorMessage } from "./ErrorMessage"
import { Messages } from "./Messages"

export const App: React.FC<{}> = ({}) => {
	const { isLoading, error, data, host } = useCanvas()

	return (
		<>
			<Messages />
			<div id="sidebar">
				<div className="window">
					<div className="title-bar">
						<div className="title-bar-text">Application</div>
					</div>
					<div className="window-body">
						{isLoading ? (
							<p>Loading...</p>
						) : data ? (
							<>
								<p>{data.uri}</p>
								<p>Using API endpoint at {host}</p>
							</>
						) : (
							<ErrorMessage error={error} />
						)}
					</div>
				</div>
				<Connect />
			</div>
		</>
	)
}
