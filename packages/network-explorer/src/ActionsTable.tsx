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
		enableSorting: false,
	},
	{
		header: "name",
		accessorKey: "message.payload.name",
		size: 200,
		enableSorting: false,
	},
	{
		header: "timestamp",
		accessorKey: "message.payload.context.timestamp",
		enableSorting: false,
	},
]

export const ActionsTable = () => {
	const [entriesPerPage, setEntriesPerPage] = useState(20)
	const params: Record<string, string> = {
		limit: (entriesPerPage + 1).toString(),
	}

	const { data, mutate: doRefresh } = useSWR(
		`/api/actions?${new URLSearchParams(params).toString()}`,
		fetchAndIpldParseJson<Result<Action>[]>,
		{
			refreshInterval: 1000,
		},
	)

	const { data: countData } = useSWR(`/api/actions/count`, fetchAndIpldParseJson<{ count: number }>, {
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
