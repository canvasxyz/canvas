import React from "react"

import useSWR from "swr"

import type { Session } from "@canvas-js/core"

interface SessionsTableProps {
	multihash: string
	onSelect: (publicKey: string) => void
}

export function SessionsTable(props: SessionsTableProps) {
	const { data, error } = useSWR<[string, Session][]>(`/api/instance/${props.multihash}/sessions`)

	if (data === undefined) {
		return error ? <code>{error.toString()}</code> : null
	}

	return (
		<div className="border border-gray-300 rounded overflow-scroll bg-gray-50 pb-3 overflow-x-scroll">
			<table className="table-auto text-left text-xs leading-tight w-full">
				<thead className="bg-white border-b border-gray-300">
					<tr>
						<th></th>
						<th className="pl-4 pr-3 pt-2.5 pb-2 font-mono">from</th>
						<th className="pl-4 pr-3 pt-2.5 pb-2 font-mono">session_public_key</th>
						<th className="pl-4 pr-3 pt-2.5 pb-2 font-mono">timestamp</th>
						<th className="pl-4 pr-3 pt-2.5 pb-2 font-mono">duration</th>
					</tr>
				</thead>
				<tbody>
					{data.map(([key, { payload }]) => (
						<tr key={key}>
							<td className="pl-3 pt-3">
								<input
									type="radio"
									name="pkey"
									className="relative top-0.25"
									value={payload.session_public_key}
									onClick={() => props.onSelect(payload.session_public_key)}
								/>
							</td>
							<td className="pl-4 pr-1 pt-3 font-mono text-xs">{payload.from.slice(0, 6)}&hellip;</td>
							<td className="pl-4 pr-1 pt-3 font-mono text-xs">{payload.session_public_key}</td>
							<td className="pl-4 pr-1 pt-3 font-mono text-xs">{payload.timestamp}</td>
							<td className="pl-4 pr-4 pt-3 font-mono text-xs">{payload.session_duration}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}
