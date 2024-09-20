import { Container, Separator, Theme } from "@radix-ui/themes"
import "@radix-ui/themes/styles.css"
import React from "react"
import ReactDOM from "react-dom/client"
import { createBrowserRouter, Route, RouterProvider, Routes } from "react-router-dom"

import "./index.css"
import HomePage from "./HomePage.js"
import Navbar from "./components/Navbar.js"

const router = createBrowserRouter([
	{
		path: "/*",
		element: (
			<Theme>
				<Container>
					<Navbar />
					<Separator size="4" />
					<Routes>
						<Route path="/" element={<HomePage />} />
					</Routes>
				</Container>
			</Theme>
		),
	},
])

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<RouterProvider router={router} />
	</React.StrictMode>,
)
