import "./App.css"

import { useCanvas, useLiveQuery, useTick, AppInfo } from "@canvas-js/hooks"
import { MouseEventHandler, useState } from "react"

import { contract, Direction, maxX, maxY, TilesList } from "./contract.js"

function App() {
	const [ticking, setTicking] = useState(() => localStorage.getItem("ticking") === "true")

	const { app, ws } = useCanvas(null, {
		topic: "canvas-example-chat-global",
		contract,
	})

	const stateQuery = useLiveQuery<typeof contract.models, "state">(app, "state")
	const state = stateQuery && (stateQuery[0] as { tiles: string; tickCount: number; gameOver: boolean })
	const tiles = state?.tiles && (JSON.parse(state.tiles) as TilesList)
	useTick(app, ticking, 400)

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
			<AppInfo app={app} ws={ws} />
			<button onClick={() => turn("n")}>{"^"}</button>
			<button onClick={() => turn("w")}>{"<"}</button>
			<button onClick={() => turn("e")}>{">"}</button>
			<button onClick={() => turn("s")}>{"v"}</button>
			<button onClick={send}>Reset</button>
			<label>
				<input
					type="checkbox"
					defaultChecked={ticking}
					onChange={(e) => {
						setTicking(e.target.checked)
						localStorage.setItem("ticking", e.target.checked.toString())
					}}
				/>
				Tick
			</label>
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
