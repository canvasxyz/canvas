import { Checkbox, Flex } from "@radix-ui/themes"
import { flexRender } from "@tanstack/react-table"
import { Row } from "@tanstack/react-table"
import { useState } from "react"

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
}: {
	children: React.ReactNode
	width: number
	onClick?: () => void
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
				paddingLeft: "6px",
				paddingTop: "4px",
				minHeight: "32px",
				width,
				cursor: onClick ? "pointer" : "default",
			}}
			onClick={onClick}
		>
			<Flex gap="2" p="1">
				{children}
			</Flex>
		</td>
	)
}

export const EditableRow = ({
	row,
	isStagedDelete,
	checked,
	onCheckedChange,
}: {
	row: Row<any>
	isStagedDelete: boolean
	checked: boolean
	onCheckedChange: (checked: boolean) => void
}) => {
	const [isEditing, setIsEditing] = useState(false)

	return (
		<tr
			style={{
				display: "flex",
				backgroundColor: isStagedDelete ? "var(--red-3)" : "transparent",
				overflow: "hidden",
				scrollbarWidth: "none",
			}}
		>
			<ThCheckbox checked={checked} onCheckedChange={onCheckedChange} />
			{row.getVisibleCells().map((cell) => (
				<Td key={cell.id} width={cell.column.getSize()} onClick={() => setIsEditing(!isEditing)}>
					{isEditing ? <></> : flexRender(cell.column.columnDef.cell, cell.getContext())}
				</Td>
			))}
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
