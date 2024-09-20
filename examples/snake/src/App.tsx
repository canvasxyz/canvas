import "./App.css"

import { TickingContract, useCanvas, useLiveQuery, useTick } from "@canvas-js/hooks"
import { MouseEventHandler } from "react"

import { contract, Direction, maxX, maxY, TilesList } from "./contract.js"

function App() {
	const { app } = useCanvas<TickingContract>(null, {
		topic: "canvas-example-chat-global",
		contract,
	})

	const stateQuery = useLiveQuery<{
		key: string
		direction: string
		tickCount: number
		tiles: string
		gameOver: string
	}>(app, "state")
	const state = stateQuery && stateQuery[0]
	const tiles = state?.tiles && (JSON.parse(state.tiles) as TilesList)
	useTick(app, "!state.0.gameOver", 200)

	const send: MouseEventHandler = (e) => {
		e.preventDefault()
		if (!app) return

		app.actions.newGame({})
	}

	const turn = (direction: Direction) => {
		if (!app) return
		app.actions.turn({ direction })
	}

	return (
		<div>
			<button onClick={() => turn("n")}>{"^"}</button>
			<button onClick={() => turn("w")}>{"<"}</button>
			<button onClick={() => turn("e")}>{">"}</button>
			<button onClick={() => turn("s")}>{"v"}</button>
			<button onClick={send}>Reset</button>
			<div>
				{state && <span>Score: {Math.floor(state.tickCount / 5)}</span>} <span>{state?.gameOver && "Game Over"}</span>
			</div>
			{state && (
				<div style={{ lineHeight: 1 }}>
					{new Array(maxY).fill(0).map((unused, yinv) => (
						<div key={maxY - yinv}>
							{new Array(maxX).fill(0).map((unused, x) => (
								<div
									key={x}
									style={{
										width: 18,
										height: 18,
										margin: "1px 2px",
										background:
											tiles &&
											tiles.find(([tileX, tileY]) => {
												const y = maxY - yinv
												return x === tileX && y === tileY
											})
												? "#fff"
												: "#333",
										display: "inline-block",
									}}
								></div>
							))}
						</div>
					))}
				</div>
			)}
		</div>
	)
}

export default App
