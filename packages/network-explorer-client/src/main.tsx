import React from "react"
import ReactDOM from "react-dom/client"
import { createBrowserRouter, RouterProvider } from "react-router-dom"

import "./index.css"
import HomePage from "./HomePage.tsx"
import Application from "./Application.tsx"
import Navbar from "./Navbar.tsx"

const router = createBrowserRouter([
	{
		path: "/",
		element: <HomePage />,
	},
	{
		path: "/application/:application",
		element: <Application />,
	},
])

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<div className="bg-[#3556A3] h-24 w-full top-14 -z-10 absolute"></div>
		<div className="max-w-4xl container mx-auto text-xs flex flex-col gap-5">
			<Navbar />
			<RouterProvider router={router} />
		</div>
	</React.StrictMode>,
)
