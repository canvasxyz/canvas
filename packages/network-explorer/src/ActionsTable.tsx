import { Table } from "./Table.js"
import { actionsTable } from "./tables.js"
import { useApplicationData } from "./hooks/useApplicationData.js"

// special case of Table where the name field options are based on data from the API
export const ActionsTable = ({
	showSidebar,
	setShowSidebar,
}: {
	showSidebar: boolean
	setShowSidebar: (showSidebar: boolean) => void
}) => {
	const applicationData = useApplicationData()

	const columns = [
		{
			header: "did",
			accessorKey: "did",
			size: 580,
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
			header: "timestamp",
			accessorKey: "timestamp",
			enableSorting: false,
			enableColumnFilter: false,
		},
	]

	return (
		<Table
			defaultSortColumn={actionsTable.defaultSortColumn}
			defaultSortDirection={actionsTable.defaultSortDirection}
			showSidebar={showSidebar}
			setShowSidebar={setShowSidebar}
			tableName={actionsTable.tableName}
			defaultColumns={columns}
		/>
	)
}
