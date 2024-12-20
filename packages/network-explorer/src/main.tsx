import { Flex, Theme } from "@radix-ui/themes"
import "@radix-ui/themes/styles.css"
import React, { Suspense } from "react"
import ReactDOM from "react-dom/client"
import { createHashRouter, Navigate, Route, RouterProvider, Routes } from "react-router-dom"

import "./index.css"
import { Sidebar } from "./Sidebar.js"
import { Table } from "./Table.js"
import { tables } from "./tables.js"

const router = createHashRouter([
	{
		path: "/*",
		element: (
			<Theme>
				<Flex height="calc(100vh - 1px)" direction="row">
					<Sidebar tables={tables} />
					<Routes>
						<Route path="*" element={<Navigate to="/$actions" replace />} />
						{tables.map(({ tableName, defaultColumns }, key) => (
							<Route
								key={key}
								path={`/${tableName}`}
								element={
									<Suspense>
										<Table tableName={tableName} defaultColumns={defaultColumns} />
									</Suspense>
								}
							/>
						))}
					</Routes>
				</Flex>
			</Theme>
		),
	},
])

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<RouterProvider router={router} />
	</React.StrictMode>,
)
