import { Navigate, useParams } from "react-router-dom"
import { Table } from "./components/table/Table.js"
import { useApplicationData } from "./hooks/useApplicationData.js"
import { BinaryCellData } from "./components/BinaryCellData.js"
import { ColumnDef } from "@tanstack/react-table"
import { EditableCell } from "./components/table/EditableCell.js"

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
				modelDefinition.properties.find((p) => modelDefinition.primaryKey.includes(p.name)) ??
				modelDefinition.properties[0]
			// use the primary property as the sorting column
			const defaultSortColumn = primaryProperty.name
			const defaultSortDirection = "asc"

			const defaultColumns = modelDefinition.properties.map((property) => {
				const columnDef: ColumnDef<any> = {
					header: property.name,
					accessorKey: property.name,
					// enable sorting on the primary property
					enableSorting: property.name === primaryProperty.name,
					enableColumnFilter: false,
					size: 320,
					meta: {
						editCell: EditableCell,
					},
				}

				if (property.kind === "primitive" && property.type === "bytes") {
					columnDef.cell = BinaryCellData
				}

				return columnDef
			})
			return (
				<Table
					defaultSortColumn={defaultSortColumn}
					defaultSortDirection={defaultSortDirection}
					enableDownload={false}
					showSidebar={showSidebar}
					setShowSidebar={setShowSidebar}
					tableName={params.model as string}
					defaultColumns={defaultColumns}
					allowEditing={true}
					getRowKey={(row) => [row.original[primaryProperty.name] as string]}
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
