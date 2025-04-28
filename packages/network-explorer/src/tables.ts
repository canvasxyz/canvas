import { ColumnDef, Row } from "@tanstack/react-table"
import { BinaryCellData } from "./components/BinaryCellData.js"

export type TableDef = {
	tableName: string
	defaultColumns: ColumnDef<any>[]
	defaultSortColumn: string
	defaultSortDirection: "desc" | "asc"
	enableDownload?: boolean
	getRowKey: (row: Row<any>) => string[]
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
		getRowKey: (row) => [row.original.key],
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
		getRowKey: (row) => [row.original.did],
	},
	{
		tableName: "$writes",
		defaultSortColumn: "record_id",
		defaultSortDirection: "asc",
		defaultColumns: [
			{
				header: "record_id",
				accessorKey: "record_id",
				size: 280,
				enableSorting: true,
				enableColumnFilter: false,
			},
			{
				header: "value",
				accessorKey: "value",
				cell: BinaryCellData,
				size: 280,
				enableSorting: false,
				enableColumnFilter: false,
			},
			{
				header: "message_id",
				accessorKey: "message_id",
				size: 280,
				enableSorting: true,
				enableColumnFilter: false,
			},
			{
				header: "csx",
				accessorKey: "csx",
				size: 280,
				enableSorting: true,
				enableColumnFilter: false,
			},
		],
		getRowKey: (row) => [row.original.record_id],
	},
	{
		tableName: "$reads",
		defaultSortColumn: "record_id",
		defaultSortDirection: "asc",
		defaultColumns: [
			{
				header: "record_id",
				accessorKey: "record_id",
				size: 280,
				enableSorting: true,
				enableColumnFilter: false,
			},
			{
				header: "reader_id",
				accessorKey: "reader_id",
				size: 280,
				enableSorting: true,
				enableColumnFilter: false,
			},
			{
				header: "writer_id",
				accessorKey: "writer_id",
				size: 280,
				enableSorting: true,
				enableColumnFilter: false,
			},
			{
				header: "csx",
				accessorKey: "csx",
				size: 280,
				enableSorting: true,
				enableColumnFilter: false,
			},
		],
		getRowKey: (row) => [row.original.record_id],
	},
	{
		tableName: "$reverts",
		defaultSortColumn: "effect_id",
		defaultSortDirection: "asc",
		defaultColumns: [
			{
				header: "effect_id",
				accessorKey: "effect_id",
				size: 280,
				enableSorting: true,
				enableColumnFilter: false,
			},
			{
				header: "cause_id",
				accessorKey: "cause_id",
				size: 280,
				enableSorting: true,
				enableColumnFilter: false,
			},
		],
		getRowKey: (row) => [row.original.effect_id],
	},
	{
		tableName: "$records",
		defaultSortColumn: "record_id",
		defaultSortDirection: "asc",
		defaultColumns: [
			{
				header: "record_id",
				accessorKey: "record_id",
				size: 280,
				enableSorting: true,
				enableColumnFilter: false,
			},
			{
				header: "model",
				accessorKey: "model",
				size: 280,
				enableSorting: true,
				enableColumnFilter: false,
			},
			{
				header: "key",
				accessorKey: "key",
				size: 280,
				enableSorting: true,
				enableColumnFilter: false,
			},
			{
				header: "version",
				accessorKey: "version",
				size: 280,
				enableSorting: true,
				enableColumnFilter: false,
			},
		],
		getRowKey: (row) => [row.original.record_id],
	},
	{
		tableName: "$heads",
		defaultSortColumn: "id",
		defaultSortDirection: "asc",
		defaultColumns: [
			{
				header: "id",
				accessorKey: "id",
				size: 280,
				enableSorting: true,
				enableColumnFilter: false,
			},
		],
		getRowKey: (row) => [row.original.id],
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
				size: 280,
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
		getRowKey: (row) => [row.original.id],
	},
	{
		tableName: "$sessions",
		defaultSortColumn: "message_id",
		defaultSortDirection: "desc",
		defaultColumns: [
			{
				header: "message_id",
				accessorKey: "message_id",
				size: 280,
				enableSorting: true,
				enableColumnFilter: false,
			},
			{
				header: "did",
				accessorKey: "did",
				size: 280,
				enableSorting: true,
				enableColumnFilter: true,
				meta: {
					textFilter: true,
				},
			},
			{
				header: "public_key",
				accessorKey: "public_key",
				size: 280,
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
		getRowKey: (row) => [row.original.message_id],
	},
]
