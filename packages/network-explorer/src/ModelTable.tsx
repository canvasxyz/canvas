import { Navigate, useParams } from "react-router-dom"
import { Table } from "./components/Table.js"
import { useApplicationData } from "./hooks/useApplicationData.js"

export const ModelTable = ({
	showSidebar,
	setShowSidebar,
}: {
	showSidebar: boolean
	setShowSidebar: (show: boolean) => void
}) => {
	const params = useParams()
	// request application data
	const applicationData = useApplicationData()

	if (applicationData !== null) {
		const modelDefinition = applicationData.models[params.model as string]
		if (modelDefinition) {
			// the primary property has kind 'primary' or is the first property in the model definition
			const primaryProperty =
				modelDefinition.properties.filter((p) => p.kind === "primary")[0] || modelDefinition.properties[0]
			// use the primary property as the sorting column
			const defaultSortColumn = primaryProperty.name
			const defaultSortDirection = "asc"

			const defaultColumns = modelDefinition.properties.map((property) => ({
				header: property.name,
				accessorKey: property.name,
				// enable sorting on the primary property
				enableSorting: property.name === primaryProperty.name,
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
