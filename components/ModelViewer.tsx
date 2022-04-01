import { string } from "fp-ts"
import React, { useMemo } from "react"

import useSWR from "swr"

export function Models(props: { multihash: string; models: Record<string, Record<string, string>> }) {
	return (
		<div>
			{Object.entries(props.models).map(([name, model]) => (
				<div key={name}>
					<div className="font-mono text-sm mt-4 mb-1">{name}</div>
					<ModelTable multihash={props.multihash} name={name} model={model} />
				</div>
			))}
		</div>
	)
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

function ModelTable(props: { multihash: string; name: string; model: Record<string, string> }) {
	const { data, error } = useSWR<Record<string, string | number | null>[]>(
		`/api/instance/${props.multihash}/models/${props.name}`,
		fetcher,
		{ refreshInterval: 1000 }
	)

	const rows = data || []

	const keys = useMemo(() => Object.keys(props.model), [props.model])

	return (
		<div className="border border-gray-300 rounded overflow-scroll bg-gray-50 pb-3 overflow-x-scroll">
			<table className="table-auto text-left text-xs leading-tight w-full">
				<thead className="bg-white border-b border-gray-300">
					<tr>
						<th className="pl-4 pr-3 pt-2.5 pb-2 font-mono">id</th>
						<th className="pl-4 pr-3 pt-2.5 pb-2 font-mono">timestamp</th>
						{keys.map((key) => (
							<th key={key} className="pl-4 pr-3 pt-2.5 pb-2 font-mono">
								{key}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row, index) => {
						return (
							<tr key={index}>
								<td className="pl-4 pr-1 pt-3 font-mono text-xs whitespace-pre">{row.id}</td>
								<td className="pl-4 pr-1 pt-3 font-mono text-xs whitespace-pre">{row.timestamp}</td>
								{keys.map((key) => (
									<td className="pl-4 pr-1 pt-3 font-mono text-xs whitespace-pre">{JSON.stringify(row[key])}</td>
								))}
							</tr>
						)
					})}
				</tbody>
			</table>
		</div>
	)
}
