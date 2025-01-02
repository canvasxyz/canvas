import { Navigate, useParams } from "react-router-dom"
import { Table } from "./Table.js"
import { useApplicationInfo } from "./useApplicationInfo.js"

export const ModelTable = () => {
	const params = useParams()
	// request application info
	const applicationInfo = useApplicationInfo()

	if (applicationInfo !== null) {
		const modelDefinition = applicationInfo.models[params.model as string]
		if (modelDefinition) {
			const defaultColumns = modelDefinition.properties.map((property) => ({
				header: property.name,
				accessorKey: property.name,
				enableSorting: false,
				enableColumnFilter: false,
				size: 400,
			}))
			return <Table tableName={params.model as string} defaultColumns={defaultColumns} />
		} else {
			// not found
			// redirect to homepage
			// TODO: display a "not found" error/toast
			return <Navigate to="/" />
		}
	}
}
