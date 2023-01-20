import React, { useEffect, useState } from "react"
import { Connect } from "./Connect"

import { useCanvas, useRoute } from "@canvas-js/hooks"

import { Icon, addIcon } from "@iconify/react/dist/offline"
import compose from "@iconify/icons-openmoji/compose"
import wastebasket from "@iconify/icons-openmoji/wastebasket"

addIcon("compose", compose)
addIcon("wastebasket", wastebasket)

type Note = {
	id: string
	title: string
	body: string
	from_id: string
	updated_at: "datetime"

	// updated_at: Date
}

export const App: React.FC<{}> = ({}) => {
	const [selectedNote, setSelectedNote] = useState<number | null>(0)
	const { isLoading, host, dispatch } = useCanvas()
	const { data, error } = useRoute<Note>("/notes", {})
	const [portalVisible, setPortalVisible] = useState(false)

	const currentNote = selectedNote !== null && data != null ? data[selectedNote] : null

	useEffect(() => {
		;(window as any).showPortal = () => {
			setPortalVisible(!portalVisible)
		}
	})

	return (
		<>
			<div className="flex flex-row h-screen overflow-hidden bg-white">
				{/* sidebar */}
				<div className="w-64 h-full border-solid border-black border-r flex-col flex shrink">
					<div className="h-16 border-b border-black flex shrink p-3">
						<div className="flex-grow"></div>
						<div
							className="shrink border border-white hover:border-gray-300 hover:bg-gray-100 rounded hover:cursor-pointer"
							onClick={() => {
								if (currentNote) {
									dispatch("deleteNote", { id: currentNote.id })
								}
							}}
						>
							<Icon icon="wastebasket" fontSize="36px"></Icon>
						</div>
					</div>
					<div
						className="flex-col grow"
						onClick={() => {
							console.log("clicked on list")
							setSelectedNote(null)
						}}
					>
						{(data || []).map((note: Note, index: number) => (
							<div
								key={`node-${index}`}
								className={`pt-2 pb-2 pl-4 pr-4 m-2 rounded hover:bg-gray-400 hover:cursor-pointer ${
									selectedNote == index ? "bg-gray-100" : "bg-white"
								}`}
								onClick={(e) => {
									console.log("clicked on element")
									e.stopPropagation()
									setSelectedNote(index)
								}}
							>
								<div className="text-sm font-bold">
									{note.title.substring(0, 30)}
									{note.title.length > 30 && "..."}
								</div>
								<div className="text-sm">
									{note.body.substring(0, 30)}
									{note.body.length > 30 && "..."}
								</div>
							</div>
						))}
					</div>
				</div>
				{/* main content */}
				<div className="overflow-y-auto overflow-x-hidden relative flex flex-col grow">
					{/* top bar? */}
					<div className="h-16 border-b border-black p-3 flex">
						<div
							className="shrink border border-white hover:border-gray-300 hover:bg-gray-100 rounded hover:cursor-pointer"
							onClick={() => {
								dispatch("createNote", { content: "whatever", title: "something" })
							}}
						>
							<Icon icon="compose" fontSize="36px"></Icon>
						</div>
						<div className="flex-grow"></div>
						<div className="shrink">
							<input className="border border-gray-400 rounded h-10 p-2" type="text" placeholder="Search"></input>
						</div>
						<div className="shrink pl-3">
							<div
								className="border border-blue-400 bg-blue-50 rounded h-10 p-2 font-semibold"
								onClick={() => setPortalVisible(true)}
							>
								Log in
							</div>
						</div>
					</div>
					{/* note content area */}
					{currentNote ? (
						<div className="pl-5 pr-5 pt-3 pb-3 grow">
							<div className="text-xl font-bold">{currentNote.title}</div>
							<div className="pt-2">{currentNote.body}</div>
							<div className="absolute right-10 bottom-10 border border-gray-400 p-3 rounded-lg bg-gray-200 hover:bg-gray-300 hover:cursor-pointer">
								Save
							</div>
						</div>
					) : (
						<div className="m-auto text-3xl font-semibold text-gray-500">No note is selected</div>
					)}
				</div>
			</div>
			{/* portal background */}
			{portalVisible && (
				<>
					<div className="absolute left-0 top-0 overflow-hidden h-screen w-screen bg-gray-500 opacity-50"></div>
					<div className="absolute left-0 top-0 overflow-hidden h-screen w-screen">
						<div className="m-auto mt-48 opacity-100 bg-red-500 w-80 z-20 p-5">
							<div className="text-xl font-bold">Log in</div>
							<Connect></Connect>
							<div className="border border-black rounded" onClick={() => setPortalVisible(false)}>
								Close
							</div>
						</div>
					</div>
				</>
			)}
		</>
	)
}
