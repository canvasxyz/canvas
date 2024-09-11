import { Container, Theme } from "@radix-ui/themes"
import "@radix-ui/themes/styles.css"
import React from "react"
import ReactDOM from "react-dom/client"
import { createBrowserRouter, Route, RouterProvider, Routes } from "react-router-dom"

import "./index.css"
import HomePage from "./home/HomePage.js"
import Navbar from "./components/Navbar.js"
import Topic from "./topic/Topic.js"

const router = createBrowserRouter([
	{
		path: "/*",
		element: (
			<Theme>
				<Container>
					<Navbar />
					<Routes>
						<Route path="/" element={<HomePage />} />
						<Route path="/topic/:topic" element={<Topic />} />
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
