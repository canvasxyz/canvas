import { useCallback, useState } from "react"
import { Map as ImmutableMap, List as ImmutableList } from "immutable"
import { ModelValue } from "@canvas-js/modeldb"

export const useModifiedRows = () => {
	const [modifiedRows, setModifiedRows] = useState<
		ImmutableMap<string, ImmutableMap<ImmutableList<string>, ModelValue>>
	>(ImmutableMap())

	const stageModifiedRow = useCallback((tableName: string, rowKey: string[], row: ModelValue) => {
		const rowKeyImmutable = ImmutableList.of(...rowKey)
		setModifiedRows((oldModifiedRows) => {
			const tableRows = oldModifiedRows.get(tableName) || ImmutableMap()
			return oldModifiedRows.set(tableName, tableRows.set(rowKeyImmutable, row))
		})
	}, [])

	const restoreModifiedRow = useCallback((tableName: string, rowKey: string[]) => {
		const rowKeyImmutable = ImmutableList.of(...rowKey)
		setModifiedRows((oldModifiedRows) => {
			const tableRows = oldModifiedRows.get(tableName) || ImmutableMap()
			return oldModifiedRows.set(tableName, tableRows.delete(rowKeyImmutable))
		})
	}, [])

	const clearModifiedRows = useCallback(() => {
		setModifiedRows(ImmutableMap())
	}, [])

	return { modifiedRows: modifiedRows || ImmutableMap(), stageModifiedRow, restoreModifiedRow, clearModifiedRows }
}
