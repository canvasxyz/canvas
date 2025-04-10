import { ColumnDef } from "@tanstack/react-table"
import { BinaryCellData } from "./components/BinaryCellData.js"

export type TableDef = {
	tableName: string
	defaultColumns: ColumnDef<any>[]
	defaultSortColumn: string
	defaultSortDirection: "desc" | "asc"
	enableDownload?: boolean
}

export const tables: TableDef[] = [
	{
		tableName: "$ancestors",
		defaultSortColumn: "key",
		defaultSortDirection: "desc",
		defaultColumns: [
			{
				header: "key",
				accessorKey: "key",
				size: 120,
				cell: BinaryCellData,
				enableSorting: true,
				enableColumnFilter: false,
			},
			{
				header: "clock",
				accessorKey: "clock",
				size: 120,
				enableSorting: true,
				enableColumnFilter: false,
			},
			{
				header: "links",
				accessorKey: "links",
				size: 120,
				cell: BinaryCellData,
				enableSorting: false,
				enableColumnFilter: false,
			},
		],
	},
	{
		tableName: "$dids",
		defaultSortColumn: "did",
		defaultSortDirection: "asc",
		defaultColumns: [
			{
				header: "did",
				accessorKey: "did",
				size: 700,
				enableSorting: true,
				enableColumnFilter: false,
			},
		],
	},
	{
		tableName: "$heads",
		defaultSortColumn: "id",
		defaultSortDirection: "asc",
		defaultColumns: [
			{
				header: "id",
				accessorKey: "id",
				size: 400,
				enableSorting: true,
				enableColumnFilter: false,
			},
		],
	},
	{
		tableName: "$messages",
		defaultSortColumn: "id",
		defaultSortDirection: "desc",
		enableDownload: true,
		defaultColumns: [
			{
				header: "id",
				accessorKey: "id",
				size: 320,
				enableSorting: true,
				enableColumnFilter: false,
			},
			{
				header: "data",
				accessorKey: "data",
				size: 120,
				cell: BinaryCellData,
				enableSorting: false,
				enableColumnFilter: false,
			},
			{
				header: "clock",
				accessorKey: "clock",
				size: 120,
				enableSorting: true,
				enableColumnFilter: false,
			},
		],
	},
	{
		tableName: "$sessions",
		defaultSortColumn: "message_id",
		defaultSortDirection: "desc",
		defaultColumns: [
			{
				header: "message_id",
				accessorKey: "message_id",
				size: 320,
				enableSorting: true,
				enableColumnFilter: false,
			},
			{
				header: "did",
				accessorKey: "did",
				size: 320,
				enableSorting: true,
				enableColumnFilter: true,
				meta: {
					textFilter: true,
				},
			},
			{
				header: "public_key",
				accessorKey: "public_key",
				size: 320,
				enableSorting: true,
				enableColumnFilter: false,
			},
			{
				header: "expiration",
				accessorKey: "expiration",
				size: 150,
				enableSorting: true,
				enableColumnFilter: false,
			},
		],
	},
]
