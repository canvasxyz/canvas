import { Checkbox, Flex } from "@radix-ui/themes"

export const TableElement = ({ children }: { children: React.ReactNode }) => {
	return <table style={{ borderCollapse: "collapse", display: "grid" }}>{children}</table>
}

export const Thead = ({ children }: { children: React.ReactNode }) => {
	return (
		<thead style={{ display: "grid", position: "sticky", top: 0, zIndex: 1, backgroundColor: "var(--color-panel)" }}>
			{children}
		</thead>
	)
}

export const Tbody = ({ children }: { children: React.ReactNode }) => {
	return (
		<tbody
			style={{
				display: "grid",
				overflowY: "scroll",
				scrollbarWidth: "none",
				position: "relative",
			}}
		>
			{children}
		</tbody>
	)
}

export const TheadSpacer = () => {
	return (
		<th
			style={{
				width: "32px",
				borderWidth: "1px",
				borderTopWidth: "0px",
				borderLeftWidth: "0px",
				borderColor: "var(--accent-3)",
				borderStyle: "solid",
			}}
		></th>
	)
}

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

export const Th = ({ width, children }: { width: number; children: React.ReactNode }) => {
	return (
		<th
			style={{
				display: "flex",
				width,
				borderWidth: "1px",
				borderTopWidth: "0px",
				borderLeftWidth: "0px",
				borderColor: "var(--accent-3)",
				borderStyle: "solid",
				paddingLeft: "6px",
				paddingTop: "4px",
				minHeight: "32px",
			}}
		>
			{children}
		</th>
	)
}

export const NoneFound = () => {
	return (
		<tr style={{ display: "flex" }}>
			<td
				style={{
					paddingTop: "20px",
					textAlign: "center",
					color: "var(--gray-10)",
					width: "calc(100vw - 200px - 400px)", // TODO: Extract sidebar width into CSS variable
				}}
			>
				None found
			</td>
		</tr>
	)
}

export const Td = ({ children, width }: { children: React.ReactNode; width: number }) => {
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
			}}
		>
			<Flex gap="2" p="1">
				{children}
			</Flex>
		</td>
	)
}
