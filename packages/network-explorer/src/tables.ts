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
				size: 350,
				enableSorting: true,
				enableColumnFilter: true,
				meta: {
					textFilter: true,
				},
			},
			{
				header: "links",
				accessorKey: "links",
				size: 700,
				enableSorting: false,
				enableColumnFilter: false,
			},
		],
	},
	{
		tableName: "$branch_merges",
		defaultSortColumn: "id",
		defaultSortDirection: "asc",
		defaultColumns: [
			{
				header: "id",
				accessorKey: "id",
				size: 150,
				enableSorting: true,
				enableColumnFilter: false,
			},
			{
				header: "source_branch",
				accessorKey: "source_branch",
				size: 150,
				enableSorting: false,
				enableColumnFilter: false,
			},
			{
				header: "source_message_id",
				accessorKey: "source_message_id",
				size: 180,
				enableSorting: false,
				enableColumnFilter: false,
			},
			{
				header: "source_clock",
				accessorKey: "source_clock",
				size: 120,
				enableSorting: false,
				enableColumnFilter: false,
			},

			{
				header: "target_branch",
				accessorKey: "target_branch",
				size: 150,
				enableSorting: false,
				enableColumnFilter: false,
			},
			{
				header: "target_message_id",
				accessorKey: "target_message_id",
				size: 180,
				enableSorting: false,
				enableColumnFilter: false,
			},
			{
				header: "target_clock",
				accessorKey: "target_clock",
				size: 120,
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
				size: 580,
				enableSorting: true,
				enableColumnFilter: false,
			},
		],
	},
	{
		tableName: "$effects",
		defaultSortColumn: "key",
		defaultSortDirection: "asc",
		defaultColumns: [
			{
				header: "key",
				accessorKey: "key",
				size: 700,
				enableSorting: true,
				enableColumnFilter: false,
			},
			{
				header: "value",
				accessorKey: "value",
				size: 100,
				cell: BinaryCellData,
				enableSorting: false,
				enableColumnFilter: false,
			},
			{
				header: "branch",
				accessorKey: "branch",
				size: 100,
				enableSorting: false,
				enableColumnFilter: false,
			},
			{
				header: "clock",
				accessorKey: "clock",
				size: 100,
				enableSorting: false,
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
				size: 580,
				enableSorting: true,
				enableColumnFilter: false,
			},
			{
				header: "branch",
				accessorKey: "branch",
				size: 100,
				enableSorting: false,
				enableColumnFilter: false,
			},
			{
				header: "clock",
				accessorKey: "clock",
				size: 100,
				enableSorting: false,
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
				size: 580,
				enableSorting: true,
				enableColumnFilter: false,
			},
			{
				header: "did",
				accessorKey: "did",
				size: 580,
				enableSorting: false,
				enableColumnFilter: true,
				meta: {
					textFilter: true,
				},
			},
			{
				header: "public_key",
				accessorKey: "public_key",
				size: 580,
				enableSorting: false,
				enableColumnFilter: false,
			},
			{
				header: "expiration",
				accessorKey: "expiration",
				size: 150,
				enableSorting: false,
				enableColumnFilter: false,
			},
		],
	},
]
