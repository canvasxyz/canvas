import React, { useMemo } from "react"

import useSWR from "swr"

interface ModelTableProps {
	multihash: string
	name: string
	model: Record<string, string>
}

export function ModelTable(props: ModelTableProps) {
	const { data, error } = useSWR<Record<string, string | number | null>[]>(
		`/api/instance/${props.multihash}/models/${props.name}`
	)

	const fields = useMemo(() => Object.keys(props.model), [props.model])

	if (data === undefined) {
		return error ? <code>{error.toString()}</code> : null
	}

	return (
		<div className="border border-gray-300 rounded overflow-scroll bg-gray-50 pb-3 overflow-x-scroll">
			<table className="table-auto text-left text-xs leading-tight w-full">
				<thead className="bg-white border-b border-gray-300">
					<tr>
						{props.name !== "_sessions" && <th className="pl-4 pr-3 pt-2.5 pb-2 font-mono">id</th>}
						{props.name !== "_sessions" && <th className="pl-4 pr-3 pt-2.5 pb-2 font-mono">timestamp</th>}
						{fields.map((field) => (
							<th key={field} className="pl-4 pr-3 pt-2.5 pb-2 font-mono">
								{field}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{data.map((row, index) => {
						return (
							<tr key={index}>
								{props.name !== "_sessions" && (
									<td className="pl-4 pr-1 pt-3 font-mono text-xs whitespace-pre">{row.id}</td>
								)}
								{props.name !== "_sessions" && (
									<td className="pl-4 pr-1 pt-3 font-mono text-xs whitespace-pre">{row.timestamp}</td>
								)}
								{fields.map((key, fieldIndex) => (
									<td
										key={fieldIndex}
										className={`pl-4 ${
											fieldIndex === fields.length - 1 ? "pr-4" : "pr-1"
										} pt-3 font-mono text-xs whitespace-pre`}
									>
										{typeof row[key] === "string" ? row[key] : JSON.stringify(row[key])}
									</td>
								))}
							</tr>
						)
					})}
				</tbody>
			</table>
		</div>
	)
}
