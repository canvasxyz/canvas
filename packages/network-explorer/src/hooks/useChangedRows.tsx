import { useCallback, useState } from "react"
import { Map as ImmutableMap, List as ImmutableList } from "immutable"
import { ModelValue } from "@canvas-js/modeldb"

export type RowChange =
	| {
			type: "delete"
	  }
	| {
			type: "create"
			value: ModelValue
	  }
	| {
			type: "update"
			value: ModelValue
	  }

type RowKey = string[]
type ImmutableRowKey = ImmutableList<string>

export const useChangedRows = () => {
	const [changedRows, setChangedRows] = useState<ImmutableMap<string, ImmutableMap<ImmutableRowKey, RowChange>>>(
		ImmutableMap(),
	)

	const stageRowChange = useCallback((tableName: string, rowKey: RowKey, rowChange: RowChange) => {
		const tableRows = changedRows.get(tableName) || ImmutableMap()
		const newTableRows = tableRows.set(ImmutableList.of(...rowKey), rowChange)
		setChangedRows(changedRows.set(tableName, newTableRows))
	}, [])

	const restoreRowChange = useCallback((tableName: string, rowKey: string[]) => {
		const tableRows = changedRows.get(tableName) || ImmutableMap()
		const newTableRows = tableRows.delete(ImmutableList.of(...rowKey))
		if (newTableRows.size === 0) {
			setChangedRows(changedRows.delete(tableName))
		} else {
			setChangedRows(changedRows.set(tableName, newTableRows))
		}
	}, [])

	const clearRowChanges = useCallback(() => {
		setChangedRows(ImmutableMap())
	}, [])

	return { changedRows, stageRowChange, restoreRowChange, clearRowChanges }
}
