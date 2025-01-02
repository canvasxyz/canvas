import { ColumnDef } from "@tanstack/react-table"
import * as cbor from "@ipld/dag-cbor"
import * as json from "@ipld/dag-json"
import { ContentPopover } from "./components/ContentPopover.js"

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
				enableSorting: true,
			},
			{
				header: "value",
				accessorKey: "value",
				size: 150,
				cell: (props) => {
					const decodedValue = cbor.decode(props.getValue() as Uint8Array)
					return ContentPopover({ value: json.stringify(decodedValue) })
				},
			},
			{
				header: "branch",
				accessorKey: "branch",
				size: 150,
				// enableSorting: true,
			},
			{
				header: "clock",
				accessorKey: "clock",
				size: 150,
				// enableSorting: true,
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
