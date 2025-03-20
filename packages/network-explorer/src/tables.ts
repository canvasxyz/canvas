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
		defaultSortColumn: "id",
		defaultSortDirection: "desc",
		defaultColumns: [
			{
				header: "id",
				accessorKey: "id",
				size: 320,
				enableSorting: true,
				enableColumnFilter: true,
				meta: {
					textFilter: true,
				},
			},
			{
				header: "links",
				accessorKey: "links",
				size: 500,
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
		tableName: "$effects",
		defaultSortColumn: "clock",
		defaultSortDirection: "desc",
		defaultColumns: [
			{
				header: "key",
				accessorKey: "key",
				size: 580,
				enableSorting: true,
				enableColumnFilter: false,
			},
			{
				header: "value",
				accessorKey: "value",
				size: 80,
				cell: BinaryCellData,
				enableSorting: false,
				enableColumnFilter: false,
			},

			{
				header: "clock",
				accessorKey: "clock",
				size: 100,
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
				header: "message",
				accessorKey: "message",
				size: 100,
				cell: BinaryCellData,
				enableSorting: false,
				enableColumnFilter: false,
			},
			{
				header: "signature",
				accessorKey: "signature",
				size: 100,
				cell: BinaryCellData,
				enableSorting: false,
				enableColumnFilter: false,
			},
			{
				header: "clock",
				accessorKey: "clock",
				size: 100,
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
