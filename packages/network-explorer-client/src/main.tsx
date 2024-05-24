import React from "react"
import ReactDOM from "react-dom/client"
import { createBrowserRouter, RouterProvider } from "react-router-dom"

import "./index.css"
import HomePage from "./HomePage.tsx"
import Topic from "./Topic.tsx"
import Container from "./Container.tsx"

const router = createBrowserRouter([
	{
		path: "/",
		element: (
			<Container>
				<HomePage />
			</Container>
		),
	},
	{
		path: "/topic/:topic",
		element: (
			<Container>
				<Topic />
			</Container>
		),
	},
])

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<RouterProvider router={router} />
	</React.StrictMode>,
)
