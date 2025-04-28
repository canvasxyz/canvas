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
