export const models = {
	posts: {
		id: "string",
		from_id: "string",
		content: "string",
		updated_at: "datetime",
	},
	likes: {
		id: "string",
		from_id: "string",
		post_id: "string",
		value: "boolean",
		updated_at: "datetime",
	},
}

export const routes = {
	"/posts": `
    SELECT posts.*, COUNT(IIF(likes.value, 1, NULL)) as likes
        FROM posts LEFT JOIN likes ON likes.post_id = posts.id
        WHERE posts.updated_at <= :t
        GROUP BY posts.id ORDER BY posts.updated_at DESC LIMIT 50`,
	"/posts/as/:from_id": `
	  SELECT posts.*, COUNT(likes.id) as likes, COUNT(my_likes.id) as my_likes,
        group_concat(likes.from_id) as all_likes
        FROM posts
        LEFT JOIN likes ON likes.post_id = posts.id
        LEFT JOIN likes my_likes ON my_likes.post_id = posts.id
            AND my_likes.post_id = posts.id AND my_likes.from_id = :from_id
        GROUP BY posts.id ORDER BY posts.updated_at DESC LIMIT 50`,
}

export const actions = {
	createPost(content) {
		this.db.posts.set(this.hash, { content, from_id: this.from })
	},
	like(postId) {
		this.db.likes.set(`${this.from}/${postId}`, { post_id: postId, from_id: this.from, value: true })
	},
	unlike(postId) {
		this.db.likes.set(`${this.from}/${postId}`, { post_id: postId, from_id: this.from, value: false })
	},
}

export const component = ({ React, routes, actions, useRef, useState, useEffect }, { props }) => {
	const [focused, setFocused] = useState(false)
	const [gamestate, setGamestate] = useState("stopped") // playing, stopped
	const [gamescore, setGamescore] = useState(0)
	// const [keydown, setKeydown] = useState(false)
	// const [gameover, setGameover] = useState(false)

	useEffect(() => {
		let score = 0
		let gameover = true
		let keydown = false
		const bird = document.querySelector(".bird")
		const ground = document.querySelector(".ground")

		let birdBottom = 200
		let jumpDelta = 10
		let gravityDelta = 5
		let movementDelta = 2

		function restart() {
			console.log("restart")
			score = 0
			birdBottom = 200
			gameover = false
			setGamescore(0)
			setGamestate("playing")
		}

		function tick() {
			if (gameover) {
				return
			}
			if (birdBottom <= 0 || birdBottom + 50 > 500 - 25) {
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
			setGamescore(score)
		}
		let gameTimerId = setInterval(tick, 20)

		document.onkeydown = (e) => {
			console.log(gameover, e.keyCode)
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
				style={{ background: "#bbb", width: 20, height: 496, position: "absolute", zIndex: 2 }}
			></div>
			<div className="game-container" style={{ background: "#aaa", position: "absolute", left: 20 }}>
				<div
					className="border-top"
					style={{
						background: "#bbb",
						width: 320,
						height: 20,
						position: "absolute",
						background: "white",
						zIndex: 2,
						top: -20,
					}}
				></div>
				<div
					className="sky"
					style={{
						background: "blue",
						width: 320,
						height: 496,
						position: "absolute",
					}}
				>
					<div
						className="bird"
						style={{
							background: "green",
							position: "absolute",
							width: 50,
							height: 45,
							left: 140,
							bottom: 100,
						}}
					></div>
				</div>
			</div>
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
					background: "#bbb",
					width: 20,
					height: 496,
					right: 0,
					position: "absolute",
					zIndex: 2,
				}}
			></div>
		</div>
	)
}
