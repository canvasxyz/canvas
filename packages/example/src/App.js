import useCanvas from "canvas-hooks"
import { useRef } from "react"
import "./App.css"

const spec = {
	models: {
		threads: {
			title: "string",
		},
	},
	routes: {
		"/threads": "SELECT * from threads;",
	},
	actions: {
		createThread: function (title) {
			if (!title || !title.trim()) throw new Error("Invalid title")
			this.db.threads.set(this.hash, { title })
		},
	},
}

const download = (text) => {
	const element = document.createElement("a")
	element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(text))
	element.setAttribute("download", "spec.canvas.js")
	element.style.display = "none"
	document.body.appendChild(element)
	element.click()
	document.body.removeChild(element)
}

function App() {
	const { views, signAndSendAction, login, logout, sessionAddress, address, core } = useCanvas(spec, {
		subscriptions: ["/threads"],
	})
	const inputRef = useRef()

	return (
		<div className="App">
			<div>Canvas Demo App</div>
			<div>
				Multihash: {core?.multihash} (
				<a href="#" onClick={() => download(core?.spec)}>
					Download
				</a>
				)
			</div>
			<form
				onSubmit={(e) => {
					e.preventDefault()
					signAndSendAction("createThread", inputRef.current.value)
					inputRef.current.value = ""
				}}
			>
				<input type="text" ref={inputRef} placeholder="Thread text" autoFocus="on" />
				<input type="submit" value="Save" />
			</form>
			<input
				type="button"
				value={sessionAddress ? `Logout ${address?.slice(0, 5)}...` : "Login"}
				onClick={(e) => {
					sessionAddress ? logout() : login()
				}}
			/>

			<br />
			<div>
				{views.get("/threads")?.map((row, index) => (
					<div key={index}>Row: {JSON.stringify(row)}</div>
				))}
			</div>
			<br />
			<div> {views.get("/threads")?.length || 0} threads</div>
		</div>
	)
}

export default App
