import { useState } from "react"
import useSWR from "swr"
import { fetchAndIpldParseJson, Result } from "./utils.js"
import { Action } from "@canvas-js/interfaces"
import { Table } from "./Table.js"
import { ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table"

const defaultColumns: ColumnDef<Result<Action>>[] = [
	{
		header: "did",
		accessorKey: "message.payload.did",
	},
	{
		header: "name",
		accessorKey: "message.payload.name",
	},
	{
		header: "timestamp",
		accessorKey: "message.payload.context.timestamp",
	},
]

export const ActionsTable = () => {
	const [entriesPerPage, setEntriesPerPage] = useState(10)
	const params = new URLSearchParams({
		limit: (entriesPerPage + 1).toString(),
		order: "desc",
	})
	// TODO: cursor pagination

	const { data } = useSWR(`/api/actions?${params.toString()}`, fetchAndIpldParseJson<Result<Action>[]>, {
		refreshInterval: 1000,
	})

	const { data: countData } = useSWR(`/api/actions/count`, fetchAndIpldParseJson<{ count: number }>, {
		refreshInterval: 1000,
	})

	const [columns] = useState<typeof defaultColumns>(() => [...defaultColumns])
	const [columnVisibility, setColumnVisibility] = useState({})

	const tanStackTable = useReactTable({
		columns,
		data: data ? data.content.slice(0, entriesPerPage) : [],
		getCoreRowModel: getCoreRowModel(),
		manualPagination: true,
		rowCount: countData ? countData.content.count : 0,
		state: {
			columnVisibility,
		},
		onColumnVisibilityChange: setColumnVisibility,
	})

	return (
		<Table
			entriesPerPage={entriesPerPage}
			setEntriesPerPage={setEntriesPerPage}
			tanStackTable={tanStackTable}
			responseTime={data?.responseTime}
		/>
	)
}
