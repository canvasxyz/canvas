import { Flex, Theme } from "@radix-ui/themes"
import "@radix-ui/themes/styles.css"
import React, { Suspense } from "react"
import ReactDOM from "react-dom/client"
import { createHashRouter, Navigate, Route, RouterProvider, Routes } from "react-router-dom"

import "./index.css"
import { Sidebar } from "./Sidebar.js"
import { ActionsTable } from "./ActionsTable.js"
import { SessionsTable } from "./SessionsTable.js"
import { MessagesTable } from "./MessagesTable.js"

const router = createHashRouter([
	{
		path: "/*",
		element: (
			<Theme>
				<Flex height="calc(100vh - 1px)" direction="row">
					<Sidebar />
					<Routes>
						<Route path="*" element={<Navigate to="/actions" replace />} />
						<Route
							path="/actions"
							element={
								<Suspense>
									<ActionsTable />
								</Suspense>
							}
						/>
						<Route
							path="/sessions"
							element={
								<Suspense>
									<SessionsTable />
								</Suspense>
							}
						/>
						<Route
							path="/messages"
							element={
								<Suspense>
									<MessagesTable />
								</Suspense>
							}
						/>
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
