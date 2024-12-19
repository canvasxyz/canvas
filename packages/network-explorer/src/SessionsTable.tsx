import { useState } from "react"
import useSWR from "swr"
import { fetchAndIpldParseJson, Result } from "./utils.js"
import { Action } from "@canvas-js/interfaces"
import { Table } from "./Table.js"
import { ColumnDef } from "@tanstack/react-table"

const defaultColumns: ColumnDef<Result<Action>>[] = [
	{
		header: "did",
		accessorKey: "message.payload.did",
		size: 580,
	},
	{
		header: "publicKey",
		accessorKey: "message.payload.publicKey",
		size: 580,
	},

	{
		header: "timestamp",
		accessorKey: "message.payload.context.timestamp",
	},
]

export const SessionsTable = () => {
	const [entriesPerPage, setEntriesPerPage] = useState(20)
	const params = new URLSearchParams({
		limit: (entriesPerPage + 1).toString(),
		order: "desc",
	})
	// TODO: cursor pagination

	const { data, mutate: doRefresh } = useSWR(
		`/api/sessions?${params.toString()}`,
		fetchAndIpldParseJson<Result<Action>[]>,
		{
			refreshInterval: 1000,
		},
	)

	const { data: countData } = useSWR(`/api/sessions/count`, fetchAndIpldParseJson<{ count: number }>, {
		refreshInterval: 1000,
	})

	return (
		<Table
			data={data ? data.content.slice(0, entriesPerPage) : []}
			rowCount={countData ? countData.content.count : 0}
			defaultColumns={defaultColumns}
			entriesPerPage={entriesPerPage}
			setEntriesPerPage={setEntriesPerPage}
			responseTime={data?.responseTime}
			doRefresh={doRefresh}
		/>
	)
}
