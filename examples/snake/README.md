# Snake Example

LINK TBD

The Snake example implements a game, using the `useTick()` hook. There are three actions:

- `newGame` resets the state of the game.
- `turn` is called whenever a player wants to turn the snake.
- `tick` is called automatically by a shared timer, and runs the main game loop,
  checking for collisions, moving the snake, and updating the score.

```ts
export const maxX = 30
export const maxY = 30

const models = {
	state: {
		key: "primary", // "0" since this is a singleton
		direction: "string",
		tickCount: "integer",
		tiles: "string",
		gameOver: "string"
	}
}

const actions = {
	newGame: (db) => {
		const centerX = Math.floor(maxX / 2)
		const centerY = Math.floor(maxY / 2)
		const tiles = JSON.stringify([
			[centerX, centerY - 1],
			[centerX, centerY],
			[centerX, centerY + 1]
		])
		db.state.set({
			key: "0",
			direction: "n",
			tickCount: 0,
			tiles,
			gameOver: ""
		})
	},
	turn: async (db, { direction }) => {
		if (["n", "e", "w", "s"].indexOf(direction) === -1) {
			throw new Error()
		}
		const { direction: currentDirection, tickCount, tiles, gameOver } = await db.state.get("0")
		if (
			(direction === "n" && currentDirection === "s") ||
			(direction === "s" && currentDirection === "n") ||
			(direction === "e" && currentDirection === "w") ||
			(direction === "w" && currentDirection === "e")
		) {
			throw new Error()
		}
		await db.state.set({ key: "0", direction, tickCount, tiles, gameOver })
	},
	tick: async (db) => {
		const { direction, tickCount, tiles, gameOver } = await db.state.get("0")
		if (gameOver) throw new Error()

		const tilesList = JSON.parse(tiles)
		const [headX, headY] = tilesList[tilesList.length - 1]

		let next
		if (direction === "n") {
			next = [headX, headY + 1]
		} else if (direction === "e") {
			next = [headX + 1, headY]
		} else if (direction === "s") {
			next = [headX, headY - 1]
		} else if (direction === "w") {
			next = [headX - 1, headY]
		}

		if (
			next[0] < 0 ||
			next[0] > maxX ||
			next[1] < 0 ||
			next[1] > maxY ||
			tilesList.some(([tx, ty]) => tx === next[0] && ty === next[1])
		) {
			await db.state.set({ key: "0", gameOver: "true", direction, tickCount, tiles })
			return
		}

		tilesList.push(next)
		if (tickCount % 5 !== 0) {
			tilesList.shift()
		}

		await db.state.set({
			key: "0",
			tickCount: tickCount + 1,
			tiles: JSON.stringify(tilesList),
			direction,
			gameOver
		})
	}
}
```
