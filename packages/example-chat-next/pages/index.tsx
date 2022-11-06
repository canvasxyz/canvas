import React from "react"
import dynamic from "next/dynamic"

import { useCanvas } from "@canvas-js/hooks"

import { ErrorMessage } from "components/ErrorMessage"
import { Messages } from "components/Messages"

const Connect = dynamic(() => import("../components/Connect").then(({ Connect }) => Connect), { ssr: false })

export default function Index(props: {}) {
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
						{isLoading ? <p>Loading...</p> : data ? <p>{data.uri}</p> : <ErrorMessage error={error} />}
					</div>
				</div>
				<Connect />
			</div>
		</>
	)
}
