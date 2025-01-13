import { ColumnFiltersState } from "@tanstack/react-table"
import { Dispatch, SetStateAction } from "react"
import { useSearchParams } from "react-router-dom"

function read<O>(searchParams: URLSearchParams, defaultValue: O): O {
	const searchParamsFilterString = searchParams.get("filter")
	let value = defaultValue
	if (searchParamsFilterString) {
		try {
			value = JSON.parse(searchParamsFilterString)
		} catch {}
	}
	return value
}

function write<O>(newValue: O): URLSearchParams {
	return new URLSearchParams({ filter: JSON.stringify(newValue) })
}

export const useSearchFilters = function (
	defaultValue: ColumnFiltersState,
): [ColumnFiltersState, Dispatch<SetStateAction<ColumnFiltersState>>] {
	const [searchParams, setSearchParams] = useSearchParams()

	const columnFilters = read(searchParams, defaultValue)

	const setColumnFilters = (newColumnFilters: SetStateAction<ColumnFiltersState>) => {
		const value = Array.isArray(newColumnFilters) ? newColumnFilters : newColumnFilters(columnFilters)
		const processedValue = write(value)
		setSearchParams(processedValue)
	}

	return [columnFilters, setColumnFilters]
}
