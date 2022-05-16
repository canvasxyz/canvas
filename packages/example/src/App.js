import { Light as SyntaxHighlighter } from "react-syntax-highlighter"
import js from "react-syntax-highlighter/dist/esm/languages/hljs/javascript"
import { github as hljsStyle } from "react-syntax-highlighter/dist/esm/styles/hljs"

import useCanvas from "canvas-hooks"
import moment from "moment"
import { useRef } from "react"

SyntaxHighlighter.registerLanguage("javascript", js)

const spec = {
	models: {
		threads: {
			title: "string",
		},
		likes: {
			threadId: "string",
			value: "boolean",
		},
	},
	routes: {
		"/threads":
			"SELECT threads.id, threads.title, threads.timestamp, COUNT(IIF(likes.value, 1, NULL)) as likes FROM threads LEFT JOIN likes ON likes.threadId = threads.id GROUP BY threads.id",
	},
	actions: {
		createThread: function (title) {
			if (!title || !title.trim()) throw new Error("Invalid title")
			this.db.threads.set(this.hash, { title })
		},
		like: function (threadId) {
			this.db.likes.set(this.from + threadId, { threadId, value: true })
		},
		unlike: function (threadId) {
			this.db.likes.set(this.from + threadId, { threadId, value: false })
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
		<div className="App break-words flex">
			<InfoPanel core={core} views={views} />
			<div className="container max-w-lg m-auto p-8 pt-16 flex">
				<div className="flex-1">
					<input
						type="button"
						value={sessionAddress ? `Logout ${address?.slice(0, 5)}...` : "Login"}
						onClick={(e) => (sessionAddress ? logout() : login()).catch((err) => alert(err))}
						className="rounded bg-blue-600 text-white cursor-pointer p-1 px-2 mb-5"
					/>

					<form
						onSubmit={(e) => {
							e.preventDefault()
							signAndSendAction("createThread", inputRef.current.value).catch((err) => alert(err))
							inputRef.current.value = ""
						}}
					>
						<textarea
							ref={inputRef}
							placeholder="What's on your mind?"
							autoFocus="on"
							className="rounded border-2 border-gray-500 p-2 px-3 mr-2 w-full"
						></textarea>
						<input
							type="submit"
							value="Post"
							className={`rounded text-white bg-blue-600 cursor-pointer p-1 px-2 ${
								sessionAddress ? "" : "disabled pointer-events-none opacity-50"
							}`}
						/>
					</form>

					<br />
					<div>
						{views.get("/threads")?.map((row, index) => (
							<div key={index} className="p-4 px-5 rounded-lg border-2 border-gray-500 mb-4 break-words">
								<div>{row.title}</div>
								<div className="text-sm mt-0.5">{moment(row.timestamp * 1000).fromNow()}</div>
								<div className="whitespace-pre-wrap w-96 font-mono text-gray-400 text-xs mt-3">
									{JSON.stringify(row)}
								</div>
								<div
									className="bg-blue-500 text-white cursor-pointer rounded p-2 px-3 mt-4"
									onClick={(e) =>
										signAndSendAction("like", row.id).catch((err) => {
											alert(err)
										})
									}
								>
									Like
									<span className="float-right mr-1">{row.likes}</span>
								</div>
								<div
									className="bg-blue-500 text-white cursor-pointer rounded p-2 px-3 mt-2"
									onClick={(e) =>
										signAndSendAction("unlike", row.id).catch((err) => {
											alert(err)
										})
									}
								>
									Unlike
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	)
}

function InfoPanel({ core, views }) {
	return (
		<div className="w-80">
			<div className="fixed w-80 m-10 text-sm">
				<div className="info-panel border-2 border-gray-600 p-4 px-5 pb-5 rounded-lg">
					<div className="font-bold">Canvas Demo</div>
					<div className="leading-snug mt-2">
						This Canvas application runs in your browser, using an embedded{" "}
						<a href="https://hypercore-protocol.org/" target="_blank" rel="noreferrer" className="underline">
							Hypercore
						</a>
						, SQL database, and JavaScript sandbox.
					</div>
					{core && (
						<div className="leading-snug mt-2">
							<div>{views.get("/threads")?.length || 0} threads</div>
							<div>{core?.hyperbee.version} log entries</div>
							<div className="leading-snug mt-2">
								{core?.multihash} (
								<span className="underline cursor-pointer" onClick={() => download(core?.spec)}>
									Download
								</span>
								)
							</div>
						</div>
					)}
				</div>
				<div className="info-panel border-2 border-gray-500 mt-4 py-3 pl-4 rounded-lg whitespace-pre-wrap break-words font-mono text-xs max-h-96 overflow-scroll">
					<SyntaxHighlighter language="javascript" style={hljsStyle} customStyle={{ background: "transparent" }}>
						{core?.spec.trim()}
					</SyntaxHighlighter>
				</div>
			</div>
		</div>
	)
}
export default App
