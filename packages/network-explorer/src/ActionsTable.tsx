import { ColumnDef } from "@tanstack/react-table"
import { Table } from "./components/table/Table.js"
import { useApplicationData } from "./hooks/useApplicationData.js"
import { usePageTitle } from "./hooks/usePageTitle.js"
// special case of Table where the name field options are based on data from the API
export const ActionsTable = ({
	showSidebar,
	setShowSidebar,
}: {
	showSidebar: boolean
	setShowSidebar: (showSidebar: boolean) => void
}) => {
	usePageTitle("$actions | Application Explorer")

	const applicationData = useApplicationData()

	const tableName = "$actions"
	const defaultSortColumn = "message_id"
	const defaultSortDirection = "desc"

	const columns: ColumnDef<any>[] = [
		{
			header: "message_id",
			accessorKey: "message_id",
			size: 280,
			enableSorting: true,
			enableColumnFilter: true,
		},
		{
			header: "timestamp",
			accessorFn: (row) => new Date(row.timestamp).toLocaleString(),
			size: 200,
			enableSorting: false,
			enableColumnFilter: false,
		},
		{
			header: "name",
			accessorKey: "name",
			size: 200,
			enableSorting: false,
			enableColumnFilter: true,
			meta: {
				filterOptions: applicationData ? applicationData.actions : [],
			},
		},
		{
			header: "did",
			accessorKey: "did",
			size: 280,
			enableSorting: false,
			enableColumnFilter: true,
			meta: {
				textFilter: true,
			},
		},
	]

	return (
		<Table
			defaultSortColumn={defaultSortColumn}
			defaultSortDirection={defaultSortDirection}
			showSidebar={showSidebar}
			setShowSidebar={setShowSidebar}
			enableDownload={false}
			tableName={tableName}
			defaultColumns={columns}
			allowEditing={false}
			getRowKey={(row) => [row.original.message_id]}
		/>
	)
}
