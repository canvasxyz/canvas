import { useState } from "react"
import useSWR from "swr"
import { fetchAndIpldParseJson, Result } from "./utils.js"
import { Action, Message, Session } from "@canvas-js/interfaces"
import { Table } from "./Table.js"
import { ColumnDef, SortingState } from "@tanstack/react-table"

const defaultColumns: ColumnDef<Result<Message<Action | Session>>>[] = [
	{
		header: "id",
		accessorKey: "id",
		size: 580,
		enableSorting: true,
	},
	{
		header: "type",
		accessorKey: "message.payload.type",
		enableSorting: false,
	},
]

export const MessagesTable = () => {
	const [sorting, setSorting] = useState<SortingState>([])

	const [entriesPerPage, setEntriesPerPage] = useState(20)
	const params: Record<string, string> = {
		limit: (entriesPerPage + 1).toString(),
	}

	// TODO: cursor pagination
	if (sorting.length === 1 && sorting[0].id === "id") {
		params.order = sorting[0].desc ? "desc" : "asc"
	}

	const { data, mutate: doRefresh } = useSWR(
		`/api/messages?${new URLSearchParams(params).toString()}`,
		fetchAndIpldParseJson<Result<Message<Action | Session>>[]>,
		{
			refreshInterval: 1000,
		},
	)

	const { data: countData } = useSWR(`/api/messages/count`, fetchAndIpldParseJson<{ count: number }>, {
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
