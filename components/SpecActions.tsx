import React, { useEffect } from "react"

import useSWR from "swr"
import { Action, ActionPayload } from "utils/server/types"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function Actions(props: { multihash: string }) {
	const { data, error } = useSWR<Action[]>(`/api/instance/${props.multihash}/actions`, fetcher, {
		refreshInterval: 1000,
	})

	return (
		<div className="border border-gray-300 rounded overflow-scroll bg-gray-50 pb-3 overflow-x-scroll">
			{data === undefined ? null : data.length === 0 ? (
				<div>No actions yet</div>
			) : (
				<table className="table-auto text-left text-xs leading-tight w-full">
					<thead className="bg-white border-b border-gray-300">
						<tr>
							<th className="pl-4 pr-3 pt-2.5 pb-2 font-mono">hash</th>
							<th className="pl-4 pr-3 pt-2.5 pb-2 font-mono">timestamp</th>
							<th className="pl-4 pr-3 pt-2.5 pb-2 font-mono">call</th>
							<th className="pl-4 pr-3 pt-2.5 pb-2 font-mono">args</th>
						</tr>
					</thead>
					<tbody>
						{data.map((action: Action, index) => {
							let payload
							try {
								payload = JSON.parse(action.payload)
							} catch (err) {
								return <></>
							}
							return (
								<tr key={index}>
									<td className="pl-4 pr-3 pt-3 font-mono text-xs">0x0000</td>
									<td className="pl-4 pr-3 pt-3 font-mono text-xs">{payload.timestamp}</td>
									<td className="pl-4 pr-3 pt-3 font-mono text-xs">{payload.name}</td>
									<td className="pl-4 pr-3 pt-3 font-mono text-xs whitespace-pre">{JSON.stringify(payload.args)}</td>
								</tr>
							)
						})}
					</tbody>
				</table>
			)}
		</div>
	)
}
