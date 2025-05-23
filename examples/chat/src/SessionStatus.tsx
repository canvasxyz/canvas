import React, { useContext, useMemo } from "react"
import { useLiveQuery } from "@canvas-js/hooks"
import { DeriveModelTypes } from "@canvas-js/modeldb"

import { AppContext } from "./AppContext.js"
import { AddressView } from "./components/AddressView.js"

const sessionSchema = {
	$sessions: {
		message_id: "primary",
		did: "string",
		public_key: "string",
		address: "string",
		expiration: "integer?",
		// $indexes: [["did"], ["public_key"]],
	},
} as const

export interface SessionStatusProps {}

export const SessionStatus: React.FC<SessionStatusProps> = ({}) => {
	const { address } = useContext(AppContext)
	if (address === null) {
		return null
	}

	return (
		<div className="p-2 border rounded flex flex-col gap-2">
			<div>
				<span className="text-sm">Address</span>
			</div>
			<div className="break-words">
				<AddressView address={address} />
			</div>
			<hr />
			<div>
				<span className="text-sm">Sessions</span>
			</div>
			<SessionList address={address} />
		</div>
	)
}

interface SessionListProps {
	address: string
}

const SessionList: React.FC<SessionListProps> = ({ address }) => {
	const { app } = useContext(AppContext)

	const timestamp = useMemo(() => Date.now(), [])

	const results = useLiveQuery<typeof sessionSchema, "$sessions">(app, "$sessions", {
		where: { address, expiration: { gt: timestamp } },
	})

	if (results === null) {
		return null
	} else if (results.length === 0) {
		return <div className="italic">No sessions</div>
	} else {
		return (
			<ul className="list-disc pl-4">
				{results.map((session) => {
					return (
						<li key={`${address}-${session.message_id}`}>
							<div>
								<code className="text-sm">{session.public_key}</code>
							</div>
							{session.expiration && session.expiration < Number.MAX_SAFE_INTEGER ? (
								<div>
									<span className="text-sm">Expires {new Date(session.expiration).toLocaleString()}</span>
								</div>
							) : (
								<div>
									<span className="text-sm">No expiration</span>
								</div>
							)}
						</li>
					)
				})}
			</ul>
		)
	}
}
