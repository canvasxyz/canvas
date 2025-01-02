import { ColumnDef } from "@tanstack/react-table"
import { BinaryCellData } from "./components/BinaryCellData.js"

export type TableDef = {
	tableName: string
	defaultColumns: ColumnDef<any>[]
}

export const tables: TableDef[] = [
	{
		tableName: "$actions",
		defaultColumns: [
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
		],
	},
	{
		tableName: "$ancestors",
		defaultColumns: [
			{
				header: "id",
				accessorKey: "id",
				size: 580,
				enableSorting: true,
			},
			{
				header: "links",
				accessorKey: "links",
				size: 580,
				// enableSorting: true,
			},
		],
	},
	{
		tableName: "$branch_merges",
		defaultColumns: [
			{
				header: "id",
				accessorKey: "id",
				size: 580,
				enableSorting: true,
			},
			{
				header: "source_branch",
				accessorKey: "source_branch",
				size: 150,
				// enableSorting: true,
			},
		],
	},
	{
		tableName: "$dids",
		defaultColumns: [
			{
				header: "did",
				accessorKey: "did",
				size: 580,
				enableSorting: true,
			},
		],
	},
	{
		tableName: "$effects",
		defaultColumns: [
			{
				header: "key",
				accessorKey: "key",
				size: 700,
				enableSorting: false,
			},
			{
				header: "value",
				accessorKey: "value",
				size: 100,
				cell: BinaryCellData,
				enableSorting: false,
			},
			{
				header: "branch",
				accessorKey: "branch",
				size: 100,
				enableSorting: false,
			},
			{
				header: "clock",
				accessorKey: "clock",
				size: 100,
				enableSorting: false,
			},
		],
	},
	{
		tableName: "$heads",
		defaultColumns: [
			{
				header: "id",
				accessorKey: "id",
				size: 400,
				enableSorting: true,
			},
		],
	},
	{
		tableName: "$messages",
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
		],
	},
	{
		tableName: "$sessions",
		defaultColumns: [
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
		],
	},
]
