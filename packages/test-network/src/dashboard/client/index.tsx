import React from "react"
import { createRoot } from "react-dom/client"

import { App } from "./App.js"

const element = document.getElementById("root")!
const root = createRoot(element)
root.render(<App />)
