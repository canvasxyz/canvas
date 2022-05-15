import useCanvas from "canvas-hooks"
import { useRef } from "react"

const spec = {
	models: {
		threads: {
			title: "string",
		},
		likes: {
			threadId: "string",
		},
	},
	routes: {
		"/threads": "SELECT threads.*, COUNT(likes.id) from threads LEFT JOIN likes ON likes.threadId = threads.id",
	},
	actions: {
		createThread: function (title) {
			if (!title || !title.trim()) throw new Error("Invalid title")
			this.db.threads.set(this.hash, { title })
		},
		like: function (threadId) {
			this.db.likes.set(this.hash, { threadId })
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
		<div className="App break-words">
			<div className="container max-w-4xl m-auto pt-16 flex">
				<InfoPanel core={core} />
				<div className="flex-1">
					<input
						type="button"
						value={sessionAddress ? `Logout ${address?.slice(0, 5)}...` : "Login"}
						onClick={(e) => {
							sessionAddress ? logout() : login()
						}}
						className="rounded bg-gray-200 hover:bg-gray-300 cursor-pointer p-1 px-2 mb-5"
					/>

					<form
						onSubmit={(e) => {
							e.preventDefault()
							signAndSendAction("createThread", inputRef.current.value)
							inputRef.current.value = ""
						}}
					>
						<textarea
							ref={inputRef}
							placeholder="What's on your mind?"
							autoFocus="on"
							className="rounded border-2 border-gray-200 p-2 px-3 mr-2 w-full"
						></textarea>
						<input
							type="submit"
							value="Post"
							className={`rounded bg-gray-200 hover:bg-gray-300 cursor-pointer p-1 px-2 ${
								sessionAddress ? "" : "disabled pointer-events-none opacity-50"
							}`}
						/>
					</form>

					<br />
					<div>
						{views.get("/threads")?.map((row, index) => (
							<div key={index} className="p-2 px-3 rounded-lg border-2 border-gray-200 mb-4 break-words">
								<div>{row.title}</div>
								<div className="whitespace-pre-wrap w-96 font-mono text-xs">{JSON.stringify(row)}</div>
							</div>
						))}
					</div>
					<br />
					<div> {views.get("/threads")?.length || 0} threads</div>
				</div>
			</div>
		</div>
	)
}

function InfoPanel({ core }) {
	return (
		<div className="w-96 mr-10">
			<div className="font-bold">Canvas Demo App</div>
			<div>
				{core?.multihash} (
				<span className="underline cursor-pointer leading-tight" onClick={() => download(core?.spec)}>
					Download
				</span>
				)
			</div>
			<div className="border-2 border-gray-200 mt-4 p-5 rounded-lg whitespace-pre-wrap break-words font-mono text-xs">
				{core?.spec.trim()}
			</div>
		</div>
	)
}
export default App
