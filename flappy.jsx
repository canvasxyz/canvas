export const models = {
	highscores: {
		id: "string",
		from_id: "string",
		name: "string",
		score: "integer",
		updated_at: "datetime",
	},
}

export const routes = {
	"/highscores": "SELECT highscores.* FROM highscores ORDER BY score DESC LIMIT 10",
}

export const actions = {
	createScore(score) {
		this.db.highscores.set(this.hash, { score, from_id: this.from })
	},
}

const birdPng =
	"data:image/png;base64,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"

export const component = ({ React, routes, actions, useRef, useState, useEffect }, { props }) => {
	const [focused, setFocused] = useState(false)
	const [gamestate, setGamestate] = useState("stopped") // playing, stopped
	const [gamescore, setGamescore] = useState(0)

	const birdLeft = 135
	const birdRight = 185
	const birdHeight = 35

	useEffect(() => {
		const bird = document.querySelector(".bird")
		const obstacleContainer = document.querySelector(".obstacle-container")
		let obstacles = []

		let gameover = true
		let keydown = false

		let score = 0
		let x = 0
		let birdBottom = 200
		let jumpDelta = 10
		let gravityDelta = 5
		let xDelta = 2
		const obstacleWidth = 50
		const obstacleSpacing = 200

		function generateObstacle(top) {
			const el = document.createElement("div")
			const obstacleHeight = Math.random() > 0.5 ? 175 : 100
			obstacleContainer.appendChild(el)
			el.style.position = "absolute"
			el.style.background = "#73bf2d"
			el.style.width = `${obstacleWidth}px`
			el.style.height = `${obstacleHeight}px`
			el.style.bottom = top ? `${496 - 20 - obstacleHeight}px` : "0px"
			el.style.left = "320px"
			obstacles.push(el)
		}

		function clearObstacles() {
			while (obstacles.length > 0) {
				obstacles.pop().remove()
			}
		}

		function restart() {
			x = 0
			score = 0
			birdBottom = 200
			gameover = false
			clearObstacles()
			generateObstacle(true)
			generateObstacle(false)
			setGamescore(0)
			setGamestate("playing")
		}

		function tick() {
			if (gameover) {
				return
			}
			if (birdBottom <= 15 || birdBottom + birdHeight > 500 - 20) {
				gameover = true
				setGamestate("stopped")
				return
			}
			if (keydown) {
				birdBottom += jumpDelta
			} else {
				birdBottom -= gravityDelta
			}
			bird.style.bottom = birdBottom + "px"
			score += 10
			x += xDelta
			obstacles.map((o) => {
				const obstacleBottom = parseInt(o.style.bottom)
				const obstacleLeft = parseInt(o.style.left)
				const obstacleRight = obstacleLeft + obstacleWidth
				const obstacleTop = obstacleBottom + parseInt(o.style.height)
				const birdTop = birdBottom + birdHeight
				o.style.left = `${obstacleLeft - xDelta}px`

				console.log(
					(birdBottom < obstacleTop && birdBottom > obstacleBottom) ||
						(birdTop < obstacleTop && birdTop > obstacleBottom),
					(birdRight > obstacleRight && birdLeft < obstacleRight) ||
						(birdRight > obstacleLeft && birdLeft < obstacleLeft)
				)
				if (
					((birdBottom < obstacleTop && birdBottom > obstacleBottom) ||
						(birdTop < obstacleTop && birdTop > obstacleBottom)) &&
					((birdRight > obstacleRight && birdLeft < obstacleRight) ||
						(birdRight > obstacleLeft && birdLeft < obstacleLeft))
				) {
					// collision
					gameover = true
					setGamestate("stopped")
					throw new Error()
				}
			})
			if (x !== 0 && x % obstacleSpacing === 0) {
				generateObstacle(true)
				generateObstacle(false)
			}
			setGamescore(score)
		}
		let gameTimerId = setInterval(tick, 20)

		document.onkeydown = (e) => {
			if (gameover && e.keyCode === 78) restart()
			if (!gameover && e.keyCode === 32) keydown = true
		}
		document.onkeyup = (e) => {
			if (e.keyCode === 32) keydown = false
		}
	}, [])

	return (
		<div tabIndex="0" onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
			<div style={{ position: "absolute", top: 30, left: 35, color: "white", zIndex: 10, font: "1.25em monospace" }}>
				Score: {gamescore}
			</div>
			{gamestate === "stopped" && (
				<div
					style={{ position: "absolute", top: 180, width: "100%", color: "white", zIndex: 10, font: "1.5em monospace" }}
				>
					<center>Press N for new game</center>
				</div>
			)}
			<div
				className="border-left"
				style={{ background: "#ded895", width: 20, top: 0, bottom: 0, position: "absolute", zIndex: 2 }}
			></div>
			<div className="game-container" style={{ background: "#aaa", position: "absolute", left: 20 }}>
				<div
					className="border-top"
					style={{
						background: "#669efe",
						width: 320,
						height: 20,
						position: "absolute",
						zIndex: 2,
						top: 0,
					}}
				></div>
				<div
					className="sky"
					style={{
						background: "#6fc5ce",
						width: 320,
						height: 496,
						position: "absolute",
					}}
				>
					<div
						className="bird"
						style={{
							position: "absolute",
							width: birdRight - birdLeft,
							height: birdHeight,
							left: birdLeft,
							bottom: 200,
						}}
					>
						<img src={birdPng} height={birdHeight} width={birdRight - birdLeft} />
					</div>
					<div className="obstacle-container"></div>
				</div>
			</div>
			<div
				className="border-bottom"
				style={{
					background: "#d7a84b",
					width: 320,
					height: 20,
					position: "absolute",
					zIndex: 2,
					left: 20,
					right: 20,
					bottom: 0,
				}}
			></div>
			<div
				className="ground-container"
				style={{
					background: "brown",
					height: 20,
					width: 320,
					left: 20,
					position: "absolute",
				}}
			>
				<div
					className="ground"
					style={{
						height: 150,
						position: "absolute",
						bottom: 0,
						zIndex: 1,
						width: "100%",
						// animation: slideright 100s infinite linear;
						// -webkit-animation: slideright 100s infinite linear;
					}}
				></div>
			</div>
			<div
				className="border-right"
				style={{
					background: "#ded895",
					width: 20,
					top: 0,
					bottom: 0,
					right: 0,
					position: "absolute",
					zIndex: 2,
				}}
			></div>
		</div>
	)
}
