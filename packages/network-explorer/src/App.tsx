import { Suspense, useState } from "react"
import { Flex } from "@radix-ui/themes"
import { Route, Routes } from "react-router-dom"

import { Sidebar } from "./components/Sidebar.js"
import { Table } from "./components/Table.js"
import { tables } from "./tables.js"

import { LandingPage } from "./LandingPage.js"
import { ModelTable } from "./ModelTable.js"
import { ActionsTable } from "./ActionsTable.js"
import { ContractView } from "./ContractView.js"

export const App = () => {
	const [showSidebar, setShowSidebar] = useState(true)

	return (
		<Flex height="calc(100vh - 1px)" direction="row">
			{showSidebar && <Sidebar tables={tables} />}
			<Routes>
				<Route path="/" element={<LandingPage />} />

				<Route
					key={"$actions"}
					path={`/tables/$actions`}
					element={
						<Suspense>
							<ActionsTable setShowSidebar={setShowSidebar} showSidebar={showSidebar} />
						</Suspense>
					}
				/>

				{tables.map(({ tableName, defaultColumns, enableDownload, defaultSortColumn, defaultSortDirection }, key) => (
					<Route
						key={key}
						path={`/tables/${tableName}`}
						element={
							<Suspense>
								<Table
									defaultSortColumn={defaultSortColumn}
									defaultSortDirection={defaultSortDirection}
									showSidebar={showSidebar}
									setShowSidebar={setShowSidebar}
									enableDownload={enableDownload || false}
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

				<Route
					key={"contract"}
					path="/contract"
					element={
						<Suspense>
							<ContractView />
						</Suspense>
					}
				/>
			</Routes>
		</Flex>
	)
}
