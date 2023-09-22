import React, { useContext, useMemo } from "react"
import { computeAddress, hexlify } from "ethers"
import { useLiveQuery } from "@canvas-js/modeldb/browser"

import { AppContext } from "./AppContext.js"
import { UserAddress } from "./UserAddress.js"

export interface ConnectStatusProps {}

export const ConnectStatus: React.FC<ConnectStatusProps> = ({}) => {
	const { address } = useContext(AppContext)
	if (address === null) {
		return null
	}

	return (
		<div className="p-2 border rounded flex flex-col gap-2">
			<div>
				<span className="text-sm">Address</span>
			</div>
			<div>
				<UserAddress address={address} />
			</div>
			<hr />
			<div>
				<span className="text-sm">Sessions</span>
			</div>
			<SessionList chain="eip155:1" address={address} />
		</div>
	)
}

export interface SessionListProps {
	chain: string
	address: string
}

export const SessionList: React.FC<SessionListProps> = ({ chain, address }) => {
	const { app } = useContext(AppContext)

	const timestamp = useMemo(() => Date.now(), [])

	const results = useLiveQuery<{ public_key_type: string; public_key: Uint8Array; expiration: number }>(
		app?.sessionDB ?? null,
		"sessions",
		{ where: { chain: "eip155:1", address, expiration: { gt: timestamp } } }
	)

	if (results === null) {
		return null
	} else if (results.length === 0) {
		return <div className="italic">No sessions</div>
	} else {
		return (
			<ul className="list-disc pl-4">
				{results.map((session) => (
					<li>
						<div>
							<UserAddress address={computeAddress(hexlify(session.public_key))} />
						</div>
						{session.expiration < Number.MAX_SAFE_INTEGER && (
							<div>
								<span className="text-sm">Expires {new Date(session.expiration).toLocaleString()}</span>
							</div>
						)}
					</li>
				))}
			</ul>
		)
	}
}
