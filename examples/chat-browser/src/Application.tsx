import React from "react"

import { useCanvas } from "@canvas-js/hooks"

import { ErrorMessage } from "./ErrorMessage"

export const ApplicationStatus: React.FC<{}> = ({}) => {
	const { isLoading, error, data } = useCanvas()

	return (
		<div className="window" style={{ width: 420 }}>
			<div className="title-bar">
				<div className="title-bar-text">Application</div>
			</div>
			<div className="window-body">
				{error !== null ? (
					<ErrorMessage error={error} />
				) : isLoading ? (
					<p>Loading...</p>
				) : data ? (
					<div>
						<p>App: {data.uri}</p>
						{data.peerId && <p data-id={data.peerId}>PeerID: {data.peerId}</p>}
					</div>
				) : null}
			</div>
		</div>
	)
}
