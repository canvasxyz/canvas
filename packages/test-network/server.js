import fs from "node:fs"
import http from "node:http"

// Minimal 1x1 white pixel favicon in Base64
const favicon = Buffer.from(
	"AAABAAEAEBAAAAEAGABoAwAAFgAAACgAAAAQAAAAIAAAAAEAGAAAAAAAAAEAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA////AAAAAAAAAAAA",
	"base64",
)

const cookies = []

const { BOOTSTRAP_LIST, MIN_CONNECTIONS, MAX_CONNECTIONS } = process.env

if (BOOTSTRAP_LIST !== undefined) cookies.push(`BOOTSTRAP_LIST=${BOOTSTRAP_LIST}`)
if (MIN_CONNECTIONS !== undefined) cookies.push(`MIN_CONNECTIONS=${MIN_CONNECTIONS}`)
if (MAX_CONNECTIONS !== undefined) cookies.push(`MAX_CONNECTIONS=${MAX_CONNECTIONS}`)

const server = http.createServer((req, res) => {
	console.log(`HTTP ${req.method} ${req.url}`)

	if (req.url === "/" && req.method === "GET") {
		res.writeHead(200, { "content-type": "text/html", "set-cookie": cookies })
		res.write(
			`<!DOCTYPE html><html lang="en"><head><script type="module" src="/index.js"></script></head><body></body></html>`,
		)
		// res.write(
		// 	`<!DOCTYPE html><html lang="en"><head><script>localStorage.debug = "libp2p:*";</script><script type="module" src="/index.js"></script></head><body></body></html>`,
		// )
		res.end()
	} else if (req.url === "/index.js" && req.method === "GET") {
		res.writeHead(200, { "content-type": "text/javascript" })
		fs.createReadStream("dist/peer-browser/index.js", "utf-8").pipe(res)
	} else if (req.url === "/favicon.ico" && req.method === "GET") {
		res.writeHead(200, { "content-type": "image/x-icon", "content-length": favicon.length })
		res.end(favicon)
	} else {
		res.writeHead(404, "Not Found", {})
		res.end()
	}
})

server.listen(3000, () => console.log("listening on http://localhost:3000"))
