import React, { useState, useEffect, useRef } from "react"
import { useCanvas, useLiveQuery } from "@canvas-js/hooks"
import { PublicChat } from "@canvas-js/templates"
import { SIWESigner } from "@canvas-js/chain-ethereum"

import { ethers } from "ethers"

import { Chess } from "chess.js"
import Chessboard from "chessboardjsx"

const toFormattedDate = (timestamp) => {
	return new Date(timestamp).toLocaleTimeString("en-US")
}

const ModelDBDemo = () => {
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
	const [state, setState] = useState({ pieceSquare: "", square: "" }) // board

	const onDrop = ({ sourceSquare, targetSquare }) => {
		app.actions.move({ from: sourceSquare, to: targetSquare })
	}

	return (
		<div>
			<Chessboard
				id="humanVsHuman"
				width={280}
				position={boards ? boards[0].fen : "start"}
				boardStyle={{
					margin: "0 auto",
					borderRadius: "5px",
					boxShadow: `0 5px 15px rgba(0, 0, 0, 0.5)`,
				}}
				onDrop={onDrop}
			/>
			<div className="caption" style={{ display: "flex", maxWidth: 280, margin: "4px auto 0" }}>
				{boards && (
					<span style={{ marginTop: 5, flex: 1 }}>
						{new Chess(boards[0].fen).turn() === "w" ? "White to move" : "Black to move"}
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

export default ModelDBDemo
