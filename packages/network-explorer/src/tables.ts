import { ColumnDef } from "@tanstack/react-table"

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
