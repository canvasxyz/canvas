import { useState } from "react"

function useCursorStack<T>() {
	const [cursors, setCursors] = useState<T[]>([])

	const pushCursor = (cursor: T) => {
		setCursors((cursors: T[]) => [...cursors, cursor])
	}

	const popCursor = () => {
		setCursors((cursors: T[]) => cursors.slice(0, -1))
	}

	const currentCursor = cursors[cursors.length - 1] || null

	return { currentCursor, pushCursor, popCursor }
}

export default useCursorStack
