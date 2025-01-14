import { ColumnFiltersState } from "@tanstack/react-table"
import { Dispatch, SetStateAction, useMemo } from "react"
import { URLSearchParamsInit, useSearchParams } from "react-router-dom"

const fromSearchParams = (searchParams: URLSearchParams, fields: string[]) => {
	const result: ColumnFiltersState = []
	for (const field of fields) {
		const value = searchParams.get(field)
		if (value) {
			result.push({ id: field, value })
		}
	}
	return result
}

const toSearchParams = (columnsState: ColumnFiltersState) => {
	const params: URLSearchParamsInit = {}
	for (const { id, value } of columnsState) {
		params[id] = value as string
	}
	return params
}

export const useSearchFilters = (
	fields: string[],
): [ColumnFiltersState, Dispatch<SetStateAction<ColumnFiltersState>>] => {
	const [searchParams, setSearchParams] = useSearchParams()

	const columnFilters = useMemo(() => fromSearchParams(searchParams, fields), [searchParams])

	const setColumnFilters = (updater: SetStateAction<ColumnFiltersState>) => {
		if (Array.isArray(updater)) {
			setSearchParams(toSearchParams(updater))
		} else {
			setSearchParams((oldParams) => {
				const oldColumnState = fromSearchParams(oldParams, fields)
				const newColumnState = updater(oldColumnState)
				const newSearchParams = toSearchParams(newColumnState)
				return newSearchParams
			})
		}
	}

	return [columnFilters, setColumnFilters]
}
