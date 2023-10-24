import { FormEvent, useRef } from "react"
import TextareaAutosize from "react-textarea-autosize"
import { Canvas } from "@canvas-js/core"

export function Composer({ app, category, replyingTo }: { app?: Canvas; category?: string; replyingTo?: string }) {
	const titleRef = useRef<HTMLInputElement>(null)
	const inputRef = useRef<HTMLTextAreaElement>(null)

	const send = (e: FormEvent) => {
		e.preventDefault()
		if (!inputRef.current) return

		if (replyingTo) {
			const reply = inputRef.current.value
			app?.actions
				.createReply({ threadId: replyingTo, reply })
				.then(() => {
					if (!inputRef.current) return
					inputRef.current.value = ""
				})
				.catch((err) => console.log(err))
		} else if (category) {
			if (!titleRef.current) return
			const message = inputRef.current.value
			const title = titleRef.current.value
			app?.actions
				.createThread({ title, message, category })
				.then(() => {
					if (inputRef.current) {
						inputRef.current.value = ""
					}
					if (titleRef.current) {
						titleRef.current.value = ""
					}
				})
				.catch((err) => console.log(err))
		} else {
			throw new Error("Unexpected: must provide either replyingTo or category")
		}
	}

	return (
		<form className="my-8" onSubmit={send}>
			{!replyingTo && <input className="input w-full mb-2" placeholder="Title" ref={titleRef} type="text" />}
			<TextareaAutosize
				className="input w-full mb-2"
				placeholder={replyingTo ? "New reply" : "New post"}
				ref={inputRef}
				minRows={3}
			/>
			<button className="btn btn-blue" type="submit">
				{replyingTo ? "Reply" : "Create Post"}
			</button>
		</form>
	)
}
