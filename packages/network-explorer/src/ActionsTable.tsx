import { Result } from "./utils.js"
import { Action } from "@canvas-js/interfaces"
import { Table } from "./Table.js"
import { ColumnDef } from "@tanstack/react-table"

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
	return <Table tableName="$actions" defaultColumns={defaultColumns} />
}
