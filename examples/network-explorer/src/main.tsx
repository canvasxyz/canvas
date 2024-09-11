import { Theme } from "@radix-ui/themes"
import React from "react"
import ReactDOM from "react-dom/client"
import { createBrowserRouter, RouterProvider } from "react-router-dom"

import "@radix-ui/themes/styles.css"

import "./index.css"
import HomePage from "./home/HomePage.js"
import Topic from "./topic/Topic.js"
import Container from "./Container.js"

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
		<Theme>
			<RouterProvider router={router} />
		</Theme>
	</React.StrictMode>,
)
