import { Navigate, useParams } from "react-router-dom"
import { Table } from "./Table.js"
import { useApplicationInfo } from "./useApplicationInfo.js"

export const ModelTable = ({
	showSidebar,
	setShowSidebar,
}: {
	showSidebar: boolean
	setShowSidebar: (show: boolean) => void
}) => {
	const params = useParams()
	// request application info
	const applicationInfo = useApplicationInfo()

	if (applicationInfo !== null) {
		const modelDefinition = applicationInfo.models[params.model as string]
		if (modelDefinition) {
			const primaryProperty = modelDefinition.properties.filter((p) => p.kind === "primary")[0]
			// use the property with type "primary" if it exists, otherwise just assume the first column is
			// the sorting/index column
			const defaultSortColumn = primaryProperty ? primaryProperty.name : modelDefinition.properties[0].name
			const defaultSortDirection = "asc"

			const defaultColumns = modelDefinition.properties.map((property) => ({
				header: property.name,
				accessorKey: property.name,
				enableSorting: false,
				enableColumnFilter: false,
				size: 400,
			}))
			return (
				<Table
					defaultSortColumn={defaultSortColumn}
					defaultSortDirection={defaultSortDirection}
					showSidebar={showSidebar}
					setShowSidebar={setShowSidebar}
					tableName={params.model as string}
					defaultColumns={defaultColumns}
				/>
			)
		} else {
			// not found
			// redirect to homepage
			// TODO: display a "not found" error/toast
			return <Navigate to="/" />
		}
	}
}
