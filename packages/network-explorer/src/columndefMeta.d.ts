import "@tanstack/react-table" //or vue, svelte, solid, qwik, etc.

declare module "@tanstack/react-table" {
	interface ColumnMeta<TData extends RowData, TValue> {
		textFilter?: boolean
		filterOptions?: string[]
		editCell?: ColumnDefTemplate<CellContext<TData, TValue>>
	}
}
