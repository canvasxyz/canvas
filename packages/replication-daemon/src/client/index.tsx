import React from "react"
import { createRoot } from "react-dom/client"

import { App } from "./App.js"
import "../../styles.css"

const container = document.querySelector("#root")
if (container === null) {
	throw new Error("missing root container element")
}

createRoot(container).render(<App />)
