import { ethers } from "ethers"
import "./App.css"

import { SIWESigner } from "@canvas-js/chain-ethereum"
import { useCanvas, useLiveQuery, useTick } from "@canvas-js/hooks"

import { contract, maxX, maxY } from "./contract.js"

function App() {
	const wallet = ethers.Wallet.createRandom()
	const { app } = useCanvas({
		contract: { ...contract, topic: "canvas-example-chat-global" },
		signers: [new SIWESigner({ signer: wallet })]
	})

	const stateQuery = useLiveQuery(app, "state")
	const state = stateQuery && stateQuery[0]
	const tiles = state?.tiles && JSON.parse(state.tiles)
	useTick(app, "!state.0.gameOver", 200)

	const send = (e) => {
		e.preventDefault()
		app.actions.newGame({})
	}

	const turn = (direction) => {
		app.actions.turn({ direction })
	}

	return (
		<div>
			<button onClick={turn.bind(this, "n")}>{"^"}</button>
			<button onClick={turn.bind(this, "w")}>{"<"}</button>
			<button onClick={turn.bind(this, "e")}>{">"}</button>
			<button onClick={turn.bind(this, "s")}>{"v"}</button>
			<button onClick={send}>Reset</button>
			<div>
				<span>Score: {Math.floor(state?.tickCount / 5)}</span> <span>{state?.gameOver && "Game Over"}</span>
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
										background: tiles.find(([tileX, tileY]) => {
											const y = maxY - yinv
											return x === tileX && y === tileY
										})
											? "#fff"
											: "#333",
										display: "inline-block"
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
