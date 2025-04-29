import { useCallback, useState } from "react"
import { Map as ImmutableMap } from "immutable"
import { RowChange } from "@canvas-js/core"

export type RowKey = string[]
export type ImmutableRowKey = string

export function encodeRowKey(rowKey: RowKey): ImmutableRowKey {
	return JSON.stringify(rowKey)
}

export function decodeRowKey(rowKey: ImmutableRowKey): RowKey {
	return JSON.parse(rowKey)
}

export const useChangedRows = () => {
	const [changedRows, setChangedRows] = useState<ImmutableMap<string, ImmutableMap<ImmutableRowKey, RowChange>>>(
		ImmutableMap(),
	)

	const stageRowChange = useCallback(
		(tableName: string, rowKey: RowKey, rowChange: RowChange) => {
			setChangedRows((oldChangedRows) => {
				const tableRows = oldChangedRows.get(tableName) || ImmutableMap()
				const newTableRows = tableRows.set(encodeRowKey(rowKey), rowChange)
				return oldChangedRows.set(tableName, newTableRows)
			})
		},
		[changedRows],
	)

	const restoreRowChange = useCallback(
		(tableName: string, rowKey: string[]) =>
			setChangedRows((oldChangedRows) => {
				const tableRows = changedRows.get(tableName) || ImmutableMap()
				const newTableRows = tableRows.delete(encodeRowKey(rowKey))
				if (newTableRows.size === 0) {
					return oldChangedRows.delete(tableName)
				} else {
					return oldChangedRows.set(tableName, newTableRows)
				}
			}),
		[changedRows],
	)

	const clearRowChanges = useCallback(() => {
		setChangedRows(ImmutableMap())
	}, [])

	return { changedRows, stageRowChange, restoreRowChange, clearRowChanges }
}
