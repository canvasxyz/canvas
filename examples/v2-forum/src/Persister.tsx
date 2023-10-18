import { encode, decode } from "microcbor"
import { Canvas } from "@canvas-js/core"

export function Persister({ app }: { app: Canvas }) {
	return (
		<div className="fixed z-10 top-3 left-3">
			<button
				className="btn btn-blue"
				onClick={async () => {
					for await (const [id, signature, message] of app.messageLog.iterate()) {
						const str = encode([signature, message])
						console.log(str)
					}
				}}
			>
				Save
			</button>
		</div>
	)
}
