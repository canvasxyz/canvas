import { useCallback, useState } from "react"
import { Map as ImmutableMap, List as ImmutableList } from "immutable"

export const useDeletedRows = () => {
	const [deletedRows, setDeletedRows] = useState<ImmutableMap<string, ImmutableList<ImmutableList<string>>>>(
		ImmutableMap(),
	)

	const stageDeletedRows = useCallback(
		(tableName: string, rowKeys: string[][]) =>
			setDeletedRows((oldDeletedRows) =>
				(oldDeletedRows || ImmutableMap()).set(
					tableName,
					ImmutableList.of(...rowKeys.map((key) => ImmutableList.of(...key))),
				),
			),
		[],
	)

	const restoreDeletedRow = useCallback(
		(tableName: string, rowKey: string[]) =>
			setDeletedRows((oldDeletedRows) => {
				const tableRows = oldDeletedRows.get(tableName)
				if (!tableRows) {
					return oldDeletedRows
				}

				const newTableRows = tableRows.filter((row) => !row.equals(ImmutableList.of(...rowKey)))

				return oldDeletedRows.set(tableName, newTableRows)
			}),
		[],
	)

	const clearDeletedRows = useCallback(() => {
		setDeletedRows(ImmutableMap())
	}, [])

	return { deletedRows: deletedRows || ImmutableMap(), stageDeletedRows, restoreDeletedRow, clearDeletedRows }
}
