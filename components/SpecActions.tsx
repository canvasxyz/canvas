export function Actions({}) {
	return (
		<div className="border border-gray-300 rounded overflow-scroll bg-gray-50 pb-3">
			<table className="table-auto text-left text-xs leading-tight w-full">
				<thead className="bg-white border-b border-gray-300">
					<tr>
						<th className="pl-4 pr-3 pt-2.5 pb-2 font-mono">hash</th>
						<th className="pl-4 pr-3 pt-2.5 pb-2 font-mono">from</th>
						<th className="pl-4 pr-3 pt-2.5 pb-2 font-mono">call</th>
						<th className="pl-4 pr-3 pt-2.5 pb-2 font-mono">data</th>
					</tr>
				</thead>
				<tbody className="">
					<tr>
						<td className="pl-4 pr-3 pt-3 font-mono text-xs">000000</td>
						<td className="pl-4 pr-3 pt-3 font-mono text-xs">0x10000</td>
						<td className="pl-4 pr-3 pt-3 font-mono text-xs">call</td>
						<td className="pl-4 pr-3 pt-3 font-mono text-xs">{"{x: 100000, y: 1}"}</td>
					</tr>
					<tr>
						<td className="pl-4 pr-3 pt-1.5 font-mono text-xs">000000</td>
						<td className="pl-4 pr-3 pt-1.5 font-mono text-xs">0x10000</td>
						<td className="pl-4 pr-3 pt-1.5 font-mono text-xs">call</td>
						<td className="pl-4 pr-3 pt-1.5 font-mono text-xs">{"{x: 100000, y: 2}"}</td>
					</tr>
					<tr>
						<td className="pl-4 pr-3 pt-1.5 font-mono text-xs">000000</td>
						<td className="pl-4 pr-3 pt-1.5 font-mono text-xs">0x10000</td>
						<td className="pl-4 pr-3 pt-1.5 font-mono text-xs">call</td>
						<td className="pl-4 pr-3 pt-1.5 font-mono text-xs">{"{x: 100000, y: 2}"}</td>
					</tr>
					<tr>
						<td className="pl-4 pr-3 pt-1.5 font-mono text-xs">000000</td>
						<td className="pl-4 pr-3 pt-1.5 font-mono text-xs">0x10000</td>
						<td className="pl-4 pr-3 pt-1.5 font-mono text-xs">call</td>
						<td className="pl-4 pr-3 pt-1.5 font-mono text-xs">{"{x: 100000, y: 2}"}</td>
					</tr>
				</tbody>
			</table>
		</div>
	)
}
