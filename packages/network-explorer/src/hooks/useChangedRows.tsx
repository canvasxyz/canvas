import { useCallback, useState } from "react"
import { Map as ImmutableMap } from "immutable"
import { RowChange } from "@canvas-js/core"

type RowKey = string[]
type ImmutableRowKey = string

export function encodeRowKey(rowKey: RowKey): string {
	return JSON.stringify(rowKey)
}

export const useChangedRows = () => {
	const [changedRows, setChangedRows] = useState<ImmutableMap<string, ImmutableMap<ImmutableRowKey, RowChange>>>(
		ImmutableMap(),
	)

	const stageRowChange = useCallback((tableName: string, rowKey: RowKey, rowChange: RowChange) => {
		const tableRows = changedRows.get(tableName) || ImmutableMap()
		const newTableRows = tableRows.set(encodeRowKey(rowKey), rowChange)
		setChangedRows(changedRows.set(tableName, newTableRows))
	}, [])

	const restoreRowChange = useCallback((tableName: string, rowKey: string[]) => {
		const tableRows = changedRows.get(tableName) || ImmutableMap()
		const newTableRows = tableRows.delete(encodeRowKey(rowKey))
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
