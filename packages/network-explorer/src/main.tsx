import { Flex, Theme } from "@radix-ui/themes"
import "@radix-ui/themes/styles.css"
import React from "react"
import ReactDOM from "react-dom/client"
import { createHashRouter, RouterProvider } from "react-router-dom"

import "./index.css"
import { Sidebar } from "./Sidebar.js"
import { Tables } from "./Tables.js"

const router = createHashRouter([
	{
		path: "/*",
		element: (
			<Theme>
				<Flex height="calc(100vh - 1px)" direction="row">
					<Sidebar />
					<Tables />
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
