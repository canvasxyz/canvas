import React from "react"

import useSWR from "swr"

import type { Session } from "core/actions"

export default function Sessions(props: { multihash: string; onSelect: Function }) {
	const { data, error } = useSWR<Session[]>(`/api/instance/${props.multihash}/sessions`)

	return (
		<div className="border border-gray-300 rounded overflow-scroll bg-gray-50 pb-3 overflow-x-scroll">
			<table className="table-auto text-left text-xs leading-tight w-full">
				<thead className="bg-white border-b border-gray-300">
					<tr>
						<th></th>
						<th className="pl-4 pr-3 pt-2.5 pb-2 font-mono">from</th>
						<th className="pl-4 pr-3 pt-2.5 pb-2 font-mono">session_public_key</th>
						<th className="pl-4 pr-3 pt-2.5 pb-2 font-mono">timestamp</th>
						<th className="pl-4 pr-3 pt-2.5 pb-2 font-mono">metadata</th>
					</tr>
				</thead>
				<tbody>
					{(data || []).map((session, index) => {
						const { timestamp, metadata, session_public_key } = JSON.parse(session.payload)
						return (
							<tr key={index}>
								<td className="pl-3 pt-3">
									<input
										type="radio"
										name="pkey"
										className="relative top-0.25"
										value={session_public_key}
										onClick={props.onSelect.bind(null, session_public_key)}
									/>
								</td>
								<td className="pl-4 pr-1 pt-3 font-mono text-xs">{session.from.slice(0, 6)}&hellip;</td>
								<td className="pl-4 pr-1 pt-3 font-mono text-xs">{session_public_key}</td>
								<td className="pl-4 pr-1 pt-3 font-mono text-xs">{timestamp}</td>
								<td className="pl-4 pr-4 pt-3 font-mono text-xs">{metadata}</td>
							</tr>
						)
					})}
				</tbody>
			</table>
		</div>
	)
}
