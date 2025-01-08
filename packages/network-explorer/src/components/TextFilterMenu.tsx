import { Button, Flex, TextField } from "@radix-ui/themes"
import { Column, ColumnFiltersState, OnChangeFn } from "@tanstack/react-table"
import { useState } from "react"

export const TextFilterMenu = ({
	column,
	columnFilters,
	setColumnFilters,
}: {
	column: Column<any, unknown>
	columnFilters: ColumnFiltersState
	setColumnFilters: OnChangeFn<ColumnFiltersState>
}) => {
	const [newFilterText, setNewFilterText] = useState("")

	const existingFilter = columnFilters.filter((f) => (f.id = column.id))[0]

	return existingFilter ? (
		<Flex
			direction="row"
			gap="2"
			onClick={(e) => {
				e.preventDefault()
			}}
			align="center"
		>
			{existingFilter.value as string}
			<Button
				ml="auto"
				color="red"
				onClick={() => {
					setColumnFilters(columnFilters.filter((f2) => f2.id !== column.id || f2.value !== existingFilter.value))
				}}
			>
				Remove
			</Button>
		</Flex>
	) : (
		<Flex direction="row" gap="2">
			<TextField.Root
				value={newFilterText}
				onChange={(e) => setNewFilterText(e.target.value)}
				placeholder="filter value"
			></TextField.Root>
			<Button
				disabled={newFilterText.length === 0}
				onClick={() => {
					const otherFilters = columnFilters.filter((f) => f.id !== column.id)

					setColumnFilters(() => [...otherFilters, { id: column.id, value: newFilterText }])
					setNewFilterText("")
				}}
			>
				Add
			</Button>
		</Flex>
	)
}
