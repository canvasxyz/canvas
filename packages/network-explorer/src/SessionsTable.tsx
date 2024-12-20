import { Result } from "./utils.js"
import { Action } from "@canvas-js/interfaces"
import { Table } from "./Table.js"
import { ColumnDef } from "@tanstack/react-table"

const defaultColumns: ColumnDef<Result<Action>>[] = [
	{
		header: "did",
		accessorKey: "did",
		size: 580,
		enableSorting: false,
	},
	{
		header: "public_key",
		accessorKey: "public_key",
		size: 580,
		enableSorting: false,
	},
	{
		header: "expiration",
		accessorKey: "expiration",
		size: 150,
		enableSorting: false,
	},
]

export const SessionsTable = () => {
	return <Table tableName="$sessions" defaultColumns={defaultColumns} />
}
