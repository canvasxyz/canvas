import { useContext } from "react"

import { CanvasContext, CanvasContextValue } from "./CanvasContext.js"

export function useCanvas(): CanvasContextValue {
	return useContext(CanvasContext)
}
