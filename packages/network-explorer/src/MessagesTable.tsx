import { Result } from "./utils.js"
import { Action, Message, Session } from "@canvas-js/interfaces"
import { Table } from "./Table.js"
import { ColumnDef } from "@tanstack/react-table"

const defaultColumns: ColumnDef<Result<Message<Action | Session>>>[] = [
	{
		header: "id",
		accessorKey: "id",
		size: 580,
		enableSorting: true,
		enableColumnFilter: false,
	},
	{
		header: "branch",
		accessorKey: "branch",
		size: 100,
		enableSorting: true,
		enableColumnFilter: false,
	},
	{
		header: "clock",
		accessorKey: "clock",
		size: 100,
		enableSorting: true,
		enableColumnFilter: false,
	},
]

export const MessagesTable = () => {
	return <Table tableName="$messages" defaultColumns={defaultColumns} />
}
