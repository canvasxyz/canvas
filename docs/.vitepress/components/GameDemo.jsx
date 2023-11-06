import React, { useState, useEffect, useRef, lazy } from "react"
import { useCanvas, useLiveQuery } from "@canvas-js/hooks"
import { PublicChat } from "@canvas-js/templates"
import { SIWESigner } from "@canvas-js/chain-ethereum"

import { ethers } from "ethers"

import { Chess } from "chess.js"

const Chessboard = lazy(() => import("chessboardjsx"))

const toFormattedDate = (timestamp) => {
	return new Date(timestamp).toLocaleTimeString("en-US")
}

const squareStyling = ({ pieceSquare, history }) => {
	// const sourceSquare = history.length && history[history.length - 1].from;
	// const targetSquare = history.length && history[history.length - 1].to;

	return {
		[pieceSquare]: { backgroundColor: "rgba(255, 255, 0, 0.4)" },
	}
}

const GameDemo = () => {
	let privateKey = localStorage.getItem("privatekey")
	if (privateKey === null) {
		privateKey = ethers.Wallet.createRandom().privateKey
		localStorage.setItem("privatekey", privateKey)
	}
	const wallet = new ethers.Wallet(privateKey)

	const { app } = useCanvas({
		contract: {
			models: {
				boards: {
					id: "primary",
					fen: "string",
				},
			},
			actions: {
				move: async (db, { from, to }, { address, timestamp, id }) => {
					const chess = new Chess((await db.boards.get("0"))?.fen || new Chess().fen())
					const move = chess.move({ from, to, promotion: "q" })
					if (move === null) throw new Error("invalid")
					db.boards.set({ id: "0", fen: chess.fen() })
				},
				reset: async (db, {}, { address, timestamp, id }) => {
					db.boards.set({ id: "0", fen: new Chess().fen() })
				},
			},
			topic: "canvas-chess",
		},
		signers: [new SIWESigner({ signer: wallet })],
	})

	const boards = useLiveQuery(app, "boards", { limit: 1 })
	const [state, setState] = useState({ pieceSquare: "" })

	const onDrop = ({ sourceSquare, targetSquare }) => {
		app.actions.move({ from: sourceSquare, to: targetSquare })
	}
	const onClick = (square) => {
		// square selection logic
		const chess = new Chess(boards[0].fen)
		const at = chess.get(square)

		if (chess.game_over()) {
			setState({ pieceSquare: "" })
			return
		}

		if (!state.pieceSquare) {
			// can't select squares other than pieces that can be moved
			if (!at || at.color !== chess.turn()) {
				setState({ pieceSquare: "" })
				return
			}
		}

		setState({ pieceSquare: square, squareStyles: squareStyling({ pieceSquare: square }) })
		app.actions
			.move({ from: state.pieceSquare, to: square })
			.then(() => {
				setState({ pieceSquare: null })
			})
			.catch(() => {
				if (!at || at.color !== chess.turn()) setState({ pieceSquare: null })
			})
	}

	const chess = boards && boards[0] && new Chess(boards[0].fen)

	return (
		<div>
			{Chessboard && (
				<Chessboard
					id="humanVsHuman"
					width={280}
					position={boards ? boards[0]?.fen : "start"}
					boardStyle={{
						margin: "0 auto",
						borderRadius: "5px",
						boxShadow: `0 5px 15px rgba(0, 0, 0, 0.5)`,
					}}
					onDrop={onDrop}
					onSquareClick={onClick}
					squareStyles={state.squareStyles}
				/>
			)}
			<div className="caption" style={{ display: "flex", maxWidth: 280, margin: "4px auto 0" }}>
				{boards && chess && (
					<span style={{ marginTop: 5, flex: 1 }}>
						{chess.in_checkmate()
							? "Checkmate!"
							: chess.in_stalemate()
							? "Stalemate"
							: chess.in_threefold_repetition()
							? "Draw by repetition"
							: chess.insufficient_material()
							? "Draw by insufficient material"
							: chess.game_over()
							? "Game over" // I think we caught everything, but maybe not?
							: chess.turn() === "w"
							? "White to move"
							: "Black to move"}
					</span>
				)}
				<input
					type="submit"
					value="Reset"
					onClick={(e) => {
						e.preventDefault()
						app.actions.reset({})
					}}
				/>
			</div>
		</div>
	)
}

export default GameDemo
