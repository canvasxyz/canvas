import { Light as SyntaxHighlighter } from "react-syntax-highlighter"
import js from "react-syntax-highlighter/dist/esm/languages/hljs/javascript"
import { github as hljsStyle } from "react-syntax-highlighter/dist/esm/styles/hljs"

import useCanvas from "@canvas-js/hooks"
import moment from "moment"
import { useRef } from "react"

SyntaxHighlighter.registerLanguage("javascript", js)

function App() {
	const { views, signAndSendAction, login, logout, sessionAddress, address, core } = useCanvas({
		specServer: "http://localhost:8000",
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
				<div className="info-panel border-2 border-gray-600 p-4 px-5 pb-5 rounded-lg max-h-96 overflow-scroll">
					<div className="font-bold">Canvas Demo</div>
					<div className="leading-snug mt-2">
						This Canvas application runs in your browser, using an embedded{" "}
						<a href="https://hypercore-protocol.org/" target="_blank" rel="noreferrer" className="underline">
							Hypercore
						</a>
						, SQL database, and JavaScript/WASM VM.
					</div>
					{core && (
						<div className="leading-snug mt-2">
							<div>{views.get("/threads")?.length || 0} threads</div>
							<div>{core?.hyperbee.version} log entries</div>
							<div className="leading-snug mt-2">
								{core?.multihash} (
								{/* <span className="underline cursor-pointer" onClick={() => download(core?.spec)}> */}
								{/* 	Download */}
								{/* </span> */})
							</div>
						</div>
					)}
					<div className="whitespace-pre-wrap break-words font-mono text-xs mt-4">
						<SyntaxHighlighter language="javascript" style={hljsStyle} customStyle={{ background: "transparent" }}>
							{core?.spec.trim()}
						</SyntaxHighlighter>
					</div>
				</div>
			</div>
		</div>
	)
}
export default App
