import { useState } from "react"
import useSWR from "swr"
import { fetchAndIpldParseJson, Result } from "./utils.js"
import { Action } from "@canvas-js/interfaces"
import { Table } from "./Table.js"
import { ColumnDef, SortingState } from "@tanstack/react-table"

const defaultColumns: ColumnDef<Result<Action>>[] = [
	{
		header: "did",
		accessorKey: "did",
		size: 580,
		enableSorting: true,
	},
	{
		header: "name",
		accessorKey: "name",
		size: 200,
		enableSorting: true,
	},
	{
		header: "timestamp",
		accessorKey: "timestamp",
		enableSorting: true,
	},
]

export const ActionsTable = () => {
	const [sorting, setSorting] = useState<SortingState>([])

	const [entriesPerPage, setEntriesPerPage] = useState(20)
	const params: Record<string, string> = {
		limit: (entriesPerPage + 1).toString(),
	}

	// TODO: cursor pagination
	if (sorting.length === 1) {
		params.orderBy = JSON.stringify({
			[sorting[0].id]: sorting[0].desc ? "desc" : "asc",
		})
	}

	const { data, mutate: doRefresh } = useSWR(
		`/api/models/$actions?${new URLSearchParams(params).toString()}`,
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
			sorting={sorting}
			setSorting={setSorting}
		/>
	)
}
