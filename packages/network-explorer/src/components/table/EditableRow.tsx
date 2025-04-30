import { ModelValue } from "@canvas-js/modeldb"
import { Checkbox, Flex } from "@radix-ui/themes"
import { flexRender } from "@tanstack/react-table"
import { Row } from "@tanstack/react-table"

export const ThCheckbox = ({
	checked,
	onCheckedChange,
}: {
	checked: boolean
	onCheckedChange: (checked: boolean) => void
}) => (
	<th
		style={{
			width: "32px",
			borderWidth: "1px",
			borderTopWidth: "0px",
			borderLeftWidth: "0px",
			borderColor: "var(--accent-3)",
			borderStyle: "solid",
		}}
	>
		<Flex justify="center" align="center" height="100%">
			<Checkbox checked={checked} onCheckedChange={onCheckedChange} />
		</Flex>
	</th>
)

export const Td = ({
	children,
	width,
	onClick,
	isEdited,
}: {
	children: React.ReactNode
	width: number
	onClick?: () => void
	isEdited?: boolean
}) => {
	return (
		<td
			style={{
				overflowX: "scroll",
				borderWidth: "1px",
				borderTopWidth: "0px",
				borderLeftWidth: "0px",
				borderColor: "var(--accent-3)",
				borderStyle: "solid",
				display: "flex",
				padding: "6px 6px 2px",
				minHeight: "32px",
				width,
				cursor: onClick ? "pointer" : "default",
				backgroundColor: isEdited ? "var(--accent-3)" : "transparent",
			}}
			onClick={onClick}
		>
			<Flex gap="2" p="1" width="100%">
				{children}
			</Flex>
		</td>
	)
}

export const EditableRow = ({
	row,
	stagedValues,
	setStagedValues,
	isStagedDelete,
	checked,
	onCheckedChange,
	isNewRow,
}: {
	row: Row<any>
	stagedValues: ModelValue | undefined
	setStagedValues: (values: ModelValue) => void
	isStagedDelete: boolean
	checked: boolean
	onCheckedChange: (checked: boolean) => void
	isNewRow?: boolean
}) => {
	return (
		<tr
			style={{
				display: "flex",
				backgroundColor: isStagedDelete ? "var(--red-3)" : isNewRow ? "var(--green-3)" : "transparent",
				overflow: "hidden",
				scrollbarWidth: "none",
			}}
		>
			<ThCheckbox checked={checked} onCheckedChange={onCheckedChange} />
			{row.getVisibleCells().map((cell) => {
				const originalValue = cell.getValue()
				const value = stagedValues && cell.column.id in stagedValues ? stagedValues[cell.column.id] : originalValue

				const isEdited = value !== originalValue

				return (
					<Td key={cell.id} width={cell.column.getSize()} isEdited={isEdited}>
						{cell.column.columnDef.meta?.editCell
							? flexRender(cell.column.columnDef.meta?.editCell, {
									value,
									setValue: (value: string) => {
										setStagedValues({ ...stagedValues, [cell.column.id]: value })
									},
							  })
							: // add something to say that the cell cannot be edited
							  flexRender(cell.column.columnDef.cell, cell.getContext())}
					</Td>
				)
			})}
		</tr>
	)
}

export const NonEditableRow = ({ row }: { row: Row<any> }) => (
	<tr style={{ display: "flex" }}>
		{row.getVisibleCells().map((cell) => (
			<Td key={cell.id} width={cell.column.getSize()}>
				{flexRender(cell.column.columnDef.cell, cell.getContext())}
			</Td>
		))}
	</tr>
)
