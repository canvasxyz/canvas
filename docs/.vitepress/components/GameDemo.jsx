import React, { useCallback, useState, useEffect, useRef, lazy } from "react"
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
		topic: "canvas-chess",
		contract: {
			models: {
				boards: {
					id: "primary",
					fen: "string",
				},
			},
			actions: {
				move: async (db, { from, to }, { address, timestamp, id }) => {
					const chess = new Chess((await db.get("boards", "0"))?.fen || new Chess().fen())
					const move = chess.move({ from, to, promotion: "q" })
					if (move === null) throw new Error("invalid")
					await db.set("boards", { id: "0", fen: chess.fen() })
				},
				reset: async (db, {}, { address, timestamp, id }) => {
					await db.set("boards", { id: "0", fen: new Chess().fen() })
				},
			},
		},
		signers: [new SIWESigner({ signer: wallet })],
	})

	const boards = useLiveQuery(app, "boards", { limit: 1 })
	const [showPeers, setShowPeers] = useState()
	const statusTextRef = useRef()

	const [synced, setSynced] = useState(false)
	const [connections, setConnections] = useState([])
	const connectionsRef = useRef(connections)

	const handleConnectionOpen = useCallback(({ detail: connection }) => {
		const connections = [...connectionsRef.current, connection]
		setConnections(connections)
		connectionsRef.current = connections
	}, [])

	const handleConnectionClose = useCallback(({ detail: connection }) => {
		const connections = connectionsRef.current.filter(({ id }) => id !== connection.id)
		setConnections(connections)
		connectionsRef.current = connections
	}, [])

	const handleSync = useCallback(({ detail: { messageCount, peer } }) => {
		setSynced(true)
		console.log(`synced with ${peer} (${messageCount} messages)`)
	}, [])

	useEffect(() => {
		if (!app) return () => {}

		app.libp2p?.addEventListener("connection:open", handleConnectionOpen)
		app.libp2p?.addEventListener("connection:close", handleConnectionClose)
		app.messageLog?.addEventListener("sync", handleSync)
		return () => {
			app.libp2p?.removeEventListener("connection:open", handleConnectionOpen)
			app.libp2p?.removeEventListener("connection:close", handleConnectionClose)
			app.messageLog?.removeEventListener("sync", handleSync)
		}
	}, [app])

	const [state, setState] = useState({ pieceSquare: "" })

	const onDrop = ({ sourceSquare, targetSquare }) => {
		app.actions.move({ from: sourceSquare, to: targetSquare }).catch(() => {
			const board = boards[0]
			if (!board) return
			const chess = new Chess(board.fen)
			const colorAtSquare = chess.get(sourceSquare).color
			const colorToMove = chess.turn()

			// flash the color to move
			if (colorToMove !== colorAtSquare) {
				statusTextRef.current.style.color = "#fff"
				setTimeout(() => {
					statusTextRef.current.style.color = "inherit"
				}, 250)
			}
		})
	}
	const onClick = (square) => {
		if (!boards || boards.length === 0) {
			setState({ pieceSquare: "" })
			return
		}
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
					position={boards ? boards[0]?.fen || "start" : "start"}
					boardStyle={{
						margin: "0 auto",
						borderRadius: "5px",
						boxShadow: `0 5px 15px rgba(0, 0, 0, 0.15)`,
					}}
					onDrop={onDrop}
					onSquareClick={onClick}
					squareStyles={state.squareStyles}
				/>
			)}
			<div className="caption" style={{ maxWidth: 280, margin: "4px auto 0" }}>
				<input
					type="submit"
					value={boards && boards[0] ? "Reset" : "New game"}
					onClick={(e) => {
						e.preventDefault()
						app.actions.reset({})
					}}
				/>
				{boards && chess && (
					<span ref={statusTextRef} style={{ marginTop: 5, marginLeft: 12 }}>
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
				<div className="peers" onClick={() => setShowPeers(!showPeers)}>
					{connections} peers
					{synced ? "" : connections.length === 0 ? ", waiting..." : ", syncing..."}
				</div>
			</div>
			{showPeers && (
				<div className="peer-details">
					{connections.map((conn) => (
						<div>
							{`[${conn?.direction}] `}
							{conn?.remoteAddr.toString()}
						</div>
					))}
				</div>
			)}
		</div>
	)
}

export default GameDemo
