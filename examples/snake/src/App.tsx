import { ethers } from "ethers"
import "./App.css"

import { SIWESigner } from "@canvas-js/chain-ethereum"
import { useCanvas, useLiveQuery, useTick } from "@canvas-js/hooks"

import { contract } from "./contract.js"

function App() {
	const wallet = ethers.Wallet.createRandom()
	const { app } = useCanvas({
		contract: { ...contract, topic: "canvas-example-chat-global" },
		signers: [new SIWESigner({ signer: wallet })]
	})

	const state = useLiveQuery(app, "state")
	useTick(app, "!state.0.gameOver", 1000)

	const send = (e) => {
		e.preventDefault()
		app.actions.newGame({})
	}

	const turn = (direction) => {
		app.actions.turn({ direction })
	}

	return (
		<div>
			<form onSubmit={send}>
				<button type="submit">Reset</button>
			</form>
			<button onClick={turn.bind(this, "n")}>{"^"}</button>
			<button onClick={turn.bind(this, "w")}>{"<"}</button>
			<button onClick={turn.bind(this, "e")}>{">"}</button>
			<button onClick={turn.bind(this, "s")}>{"v"}</button>
			<div>{state && JSON.stringify(state)}</div>
		</div>
	)
}

export default App
