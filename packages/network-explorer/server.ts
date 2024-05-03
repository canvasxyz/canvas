import next from "next"
import express from "express"

const HTTP_PORT = parseInt(process.env.PORT || "3000", 10)
const HTTP_ADDR = "0.0.0.0"

const dev = process.env.NODE_ENV !== "production"
const app = next({ dev })
const handle = app.getRequestHandler()

await app.prepare()

const expressApp = express()
expressApp.use(express.json())

expressApp.all("*", (req, res) => {
	return handle(req, res)
})

expressApp.listen(HTTP_PORT, HTTP_ADDR, () => {
	console.log(`> Ready on http://${HTTP_ADDR}:${HTTP_PORT}`)
})
