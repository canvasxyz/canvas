import { ColumnFiltersState } from "@tanstack/react-table"
import { Dispatch, SetStateAction } from "react"
import { useSearchParams } from "react-router-dom"

export const useSearchFilters = (
	defaultValue: ColumnFiltersState,
): [ColumnFiltersState, Dispatch<SetStateAction<ColumnFiltersState>>] => {
	const [searchParams, setSearchParams] = useSearchParams()

	const searchParamsFilterString = searchParams.get("filter")
	let columnFilters = defaultValue
	if (searchParamsFilterString) {
		try {
			columnFilters = JSON.parse(searchParamsFilterString)
		} catch {}
	}

	const setColumnFilters = (updater: SetStateAction<ColumnFiltersState>) => {
		if (Array.isArray(updater)) {
			setSearchParams(new URLSearchParams({ filter: JSON.stringify(updater) }))
		} else {
			setSearchParams((oldParams) => {
				const searchParamsFilterString = oldParams.get("filter")
				let columnFilters = defaultValue
				if (searchParamsFilterString) {
					try {
						columnFilters = JSON.parse(searchParamsFilterString)
					} catch {}
				}

				return { filter: JSON.stringify(updater(columnFilters)) }
			})
		}
	}

	return [columnFilters, setColumnFilters]
}
