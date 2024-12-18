import useSWR from "swr"
import { fetchAndIpldParseJson, Result } from "./utils.js"
import { Action } from "@canvas-js/interfaces"
import { Table } from "./Table.js"
import { getCoreRowModel, useReactTable } from "@tanstack/react-table"

const ACTION_COLUMNS = [
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
	// TODO: filters, sorting, pagination
	const params = ""
	const { data } = useSWR(`/api/actions?${params.toString()}`, fetchAndIpldParseJson<Result<Action>[]>, {
		refreshInterval: 1000,
	})

	const tanStackTable = useReactTable({
		columns: ACTION_COLUMNS,
		data: data ? data.content : [],
		getCoreRowModel: getCoreRowModel(),
	})

	return <Table tanStackTable={tanStackTable} responseTime={data?.responseTime} />
}
