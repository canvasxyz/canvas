import React, { useContext, useEffect, useState } from "react"
import { bytesToHex } from "@noble/hashes/utils"

import type { CanvasEvents } from "@canvas-js/core"
import { MessageId } from "@canvas-js/gossiplog"

import { AppContext } from "./AppContext.js"

export interface LogStatusProps {}

export const LogStatus: React.FC<LogStatusProps> = ({}) => {
	const { app } = useContext(AppContext)

	const [root, setRoot] = useState<string | null>(null)
	const [heads, setHeads] = useState<MessageId[] | null>(null)
	useEffect(() => {
		if (app === null) {
			return
		}

		app.messageLog.tree.read((txn) => txn.getRoot()).then((root) => setRoot(`${root.level}:${bytesToHex(root.hash)}`))
		app.db
			.getAll<{ id: string }>("$heads")
			.then((records) => setHeads(records.map((record) => MessageId.encode(record.id))))

		const handleCommit = ({ detail: { root, heads } }: CanvasEvents["commit"]) => {
			const rootValue = `${root.level}:${bytesToHex(root.hash)}`
			setRoot(rootValue)
			setHeads(heads.map(MessageId.encode))
		}

		app.addEventListener("commit", handleCommit)
		return () => app.removeEventListener("commit", handleCommit)
	}, [app])

	if (app === null) {
		return null
	}

	return (
		<div className="p-2 border rounded flex flex-col gap-2">
			<div>
				<span className="text-sm">Merkle root</span>
			</div>
			<div>
				{root !== null ? <code className="text-sm">{root}</code> : <span className="text-sm italic">none</span>}
			</div>
			<div>
				<span className="text-sm">Message heads</span>
			</div>
			<div>
				{heads !== null ? (
					<ul className="list-disc pl-4">
						{heads.map((head) => (
							<li key={head.id}>
								<code className="text-sm">{head.id}</code>
								<span className="text-sm ml-2 text-gray-500">(clock: {head.clock})</span>
							</li>
						))}
					</ul>
				) : (
					<span className="text-sm italic">none</span>
				)}
			</div>
		</div>
	)
}
