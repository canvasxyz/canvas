import { Flex } from "@radix-ui/themes"
import { Sidebar } from "./Sidebar.js"
import { Table } from "./Table.js"
import { Navigate, Route, Routes } from "react-router-dom"
import { tables } from "./tables.js"
import { Suspense, useState } from "react"
import { ModelTable } from "./ModelTable.js"
import { ActionsTable } from "./ActionsTable.js"

export const App = () => {
	const [showSidebar, setShowSidebar] = useState(true)

	return (
		<Flex height="calc(100vh - 1px)" direction="row">
			{showSidebar && <Sidebar tables={tables} />}
			<Routes>
				<Route path="*" element={<Navigate to="/$actions" replace />} />

				<Route
					key={"$actions"}
					path={`/$actions`}
					element={
						<Suspense>
							<ActionsTable setShowSidebar={setShowSidebar} showSidebar={showSidebar} />
						</Suspense>
					}
				/>

				{tables.map(({ tableName, defaultColumns, defaultSortColumn, defaultSortDirection }, key) => (
					<Route
						key={key}
						path={`/${tableName}`}
						element={
							<Suspense>
								<Table
									defaultSortColumn={defaultSortColumn}
									defaultSortDirection={defaultSortDirection}
									showSidebar={showSidebar}
									setShowSidebar={setShowSidebar}
									tableName={tableName}
									defaultColumns={defaultColumns}
								/>
							</Suspense>
						}
					/>
				))}
				<Route
					key={"models"}
					path={`/models/:model`}
					element={
						<Suspense>
							<ModelTable showSidebar={showSidebar} setShowSidebar={setShowSidebar} />
						</Suspense>
					}
				/>
			</Routes>
		</Flex>
	)
}
