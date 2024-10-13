import type { Contract } from "@canvas-js/core"

export const maxX = 30
export const maxY = 30

export type Direction = "n" | "w" | "e" | "s"
export type TilesList = [number, number][]

type State = {
	key: number
	direction: Direction
	tickCount: number
	tiles: string
	gameOver: "true" | ""
}

export const contract: Contract = {
	models: {
		state: {
			key: "primary", // "0" since this is a singleton
			direction: "string",
			tickCount: "integer",
			tiles: "string",
			gameOver: "string",
		},
	},
	actions: {
		newGame: (db) => {
			const maxX = 30
			const maxY = 30
			const centerX = Math.floor(maxX / 2)
			const centerY = Math.floor(maxY / 2)
			const tiles = JSON.stringify([
				[centerX, centerY - 1],
				[centerX, centerY],
				[centerX, centerY + 1],
			])
			db.set("state", {
				key: "0",
				direction: "n",
				tickCount: 0,
				tiles,
				gameOver: "",
			})
		},
		turn: async (db, { direction }) => {
			if (["n", "e", "w", "s"].indexOf(direction) === -1) {
				throw new Error()
			}
			const state = (await db.get("state", "0")) as State | null
			if (state === null) {
				return
			}
			const { direction: currentDirection, tickCount, tiles, gameOver } = state

			if (
				(direction === "n" && currentDirection === "s") ||
				(direction === "s" && currentDirection === "n") ||
				(direction === "e" && currentDirection === "w") ||
				(direction === "w" && currentDirection === "e")
			) {
				throw new Error()
			}
			await db.set("state", { key: "0", direction, tickCount, tiles, gameOver })
		},
		tick: async (db) => {
			const maxX = 30
			const maxY = 30

			const state = (await db.get("state", "0")) as State | null
			if (state === null) {
				throw new Error("uninitialized")
			}
			const { direction, tickCount, tiles, gameOver } = state
			if (gameOver) throw new Error()

			const tilesList = JSON.parse(tiles) as TilesList
			const [headX, headY] = tilesList[tilesList.length - 1]

			let next: [number, number]
			if (direction === "n") {
				next = [headX, headY + 1]
			} else if (direction === "e") {
				next = [headX + 1, headY]
			} else if (direction === "s") {
				next = [headX, headY - 1]
			} else if (direction === "w") {
				next = [headX - 1, headY]
			} else {
				throw new Error(`invalid value for 'direction' given: ${direction}`)
			}

			// make snake wraparound instead of ending the game when hitting a corner
			if (next[0] < 0) {
				next[0] = maxX
			} else if (next[0] > maxX) {
				next[0] = 0
			} else if (next[1] < 0) {
				next[1] = maxY
			} else if (next[1] > maxY) {
				next[1] = 0
			}

			if (tilesList.some(([tx, ty]) => tx === next[0] && ty === next[1])) {
				await db.set("state", { key: "0", gameOver: "true", direction, tickCount, tiles })
				console.log("game ended")
				return
			}

			tilesList.push(next)
			if (tickCount % 5 !== 0) {
				tilesList.shift()
			}

			await db.set("state", {
				key: "0",
				tickCount: tickCount + 1,
				tiles: JSON.stringify(tilesList),
				direction,
				gameOver,
			})
		},
	},
} satisfies Contract
