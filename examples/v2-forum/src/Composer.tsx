import { FormEvent, useRef } from "react"
import TextareaAutosize from "react-textarea-autosize"
import { Canvas } from "@canvas-js/core"

export function Composer({
	app,
	channel,
	replyingTo,
	setReplyingTo,
}: {
	app?: Canvas
	channel?: string
	replyingTo?: string
	setReplyingTo: (arg0: string) => void
}) {
	const inputRef = useRef<HTMLTextAreaElement>(null)

	const send = (e: FormEvent) => {
		e.preventDefault()
		if (!inputRef.current) return

		if (replyingTo) {
			const reply = inputRef.current.value
			app?.actions
				.sendReply({ threadId: replyingTo, reply })
				.then(() => {
					if (!inputRef.current) return
					inputRef.current.value = ""
				})
				.catch((err) => console.log(err))
		} else if (channel) {
			const message = inputRef.current.value
			app?.actions
				.sendMessage({ message, channel })
				.then(() => {
					if (!inputRef.current) return
					inputRef.current.value = ""
				})
				.catch((err) => console.log(err))
		} else {
			throw new Error("Unexpected: must provide either replyingTo or channel")
		}
	}

	return (
		<form className="my-8" onSubmit={send}>
			<TextareaAutosize className="input w-full" placeholder="New post" ref={inputRef} minRows={3} />
			<div className="flex">
				<div className="flex-1">
					<button className="btn btn-blue" type="submit">
						{replyingTo ? "Reply" : "Create Post"}
					</button>
				</div>
				{replyingTo && (
					<div className="text-gray-600 mt-1.5">
						Replying to: {replyingTo} -{" "}
						<a
							href="#"
							onClick={(e) => {
								e.preventDefault()
								setReplyingTo("")
							}}
						>
							Clear
						</a>
					</div>
				)}
			</div>
		</form>
	)
}
