import React from "react"

import useSWR from "swr"

import type { Action } from "@canvas-js/core"

export function ActionsTable(props: { multihash: string }) {
	const { data, error } = useSWR<[string, Action][]>(`/api/instance/${props.multihash}/actions`)

	if (data === undefined) {
		return error ? <code>{error.toString()}</code> : null
	}

	return (
		<div className="border border-gray-300 rounded overflow-scroll bg-gray-50 pb-3 overflow-x-scroll">
			<table className="table-auto text-left text-xs leading-tight w-full">
				<thead className="bg-white border-b border-gray-300">
					<tr>
						<th className="pl-4 pr-3 pt-2.5 pb-2 font-mono">hash</th>
						<th className="pl-4 pr-3 pt-2.5 pb-2 font-mono">call</th>
						<th className="pl-4 pr-3 pt-2.5 pb-2 font-mono">args</th>
						<th className="pl-4 pr-3 pt-2.5 pb-2 font-mono">timestamp</th>
					</tr>
				</thead>
				<tbody>
					{data.map(([id, { payload }], index) => (
						<tr key={index}>
							<td className="pl-4 pr-1 pt-3 font-mono text-xs">{id.slice(0, 6)}&hellip;</td>
							<td className="pl-4 pr-1 pt-3 font-mono text-xs">{payload.call}</td>
							<td className="pl-4 pr-1 pt-3 font-mono text-xs whitespace-pre">{JSON.stringify(payload.args)}</td>
							<td className="pl-4 pr-4 pt-3 font-mono text-xs">{payload.timestamp}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}
