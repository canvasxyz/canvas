import React from "react"
import ComposeIcon from "./icons/compose.svg"

function formatUpdatedAt(updatedAtTs: number) {
	const now = new Date()
	const updatedAt = new Date(updatedAtTs)

	const dayMs = 1000 * 60 * 60 * 24

	// create new date objects with the local dates for now and updatedAt
	// where the hour/minute/second/millisecond fields are 0
	const day0now = new Date(now.getFullYear(), now.getMonth(), now.getDay())
	const day0updatedAt = new Date(updatedAt.getFullYear(), updatedAt.getMonth(), updatedAt.getDay())

	const diffMs = day0updatedAt.getTime() - day0now.getTime()
	const diffDays = diffMs / dayMs

	if (diffDays == 0) {
		// return time
		return updatedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "numeric" })
	} else if (diffDays < 7) {
		// return day of week
		return updatedAt.toLocaleDateString(undefined, { weekday: "long" })
	} else {
		return updatedAt.toLocaleDateString()
	}
}

const IconButton = ({ icon, onClick, disabled }: { onClick: () => void; icon: any; disabled: boolean }) => {
	return (
		<div
			className={`shrink border rounded ${
				disabled
					? "bg-gray-200 hover:cursor-not-allowed"
					: "bg-gray-50 border-gray-400 drop-shadow-md hover:drop-shadow active:drop-shadow-sm hover:cursor-pointer hover:border-gray-300 hover:bg-gray-100"
			}`}
			onClick={disabled ? () => {} : onClick}
		>
			{icon({ className: disabled ? "stroke-gray-500" : "stroke-black", width: "36px" })}
		</div>
	)
}

export const App: React.FC<{}> = ({}) => {
	const now = new Date()

	const currentUser = {
		ens: "syntacrobat.eth",
		address: "0x2AdC396D8092D79Db0fA8a18fa7e3451Dc1dFB37",
	}

	const messages = [
		{
			content: "hello",
			creator_id: "1",
			created_at: new Date((now as any) - 100000),
		},
		{
			content: "bye",
			creator_id: "2",
			created_at: new Date((now as any) - 90000),
		},
		{
			content: "ok",
			creator_id: "1",
			created_at: new Date((now as any) - 80000),
		},
	]

	return (
		<>
			<div className="flex flex-row h-screen overflow-hidden bg-white">
				{/* sidebar */}
				<div className="w-64 h-full border-solid border-gray-200 border-r flex-col flex shrink">
					<div className="h-16 flex shrink p-3 items-center">Encrypted Chat</div>
					<div className="h-16 flex shrink p-3 items-center">
						<div className="flex-grow">Conversations</div>
						<IconButton onClick={async () => {}} icon={ComposeIcon} disabled={false} />
					</div>
					<div className="overflow-auto">
						<div
							// key={`node-${note.local_id}`}
							className={`pt-2 pb-2 pl-4 pr-4 m-2 rounded hover:bg-gray-400 hover:cursor-pointer ${
								true ? "bg-gray-200" : "bg-gray-50"
							}`}
							onClick={(e) => {
								e.stopPropagation()
								// select item
							}}
						>
							<div className="text-sm font-bold">{currentUser.ens}</div>
						</div>
					</div>
				</div>
				{/* main content */}
				<div className="overflow-y-auto overflow-x-hidden relative flex flex-col grow">
					{/* top bar? */}
					<div className="h-16 p-3 flex items-center">{currentUser.ens}</div>
					{true ? (
						<>
							<div className="flex flex-col grow m-3 gap-3">
								{messages.map((message, index) => {
									const is_sent = message.creator_id == "1"
									return (
										<>
											<div className="flex justify-center text-gray-300">{message.created_at.toLocaleTimeString()}</div>
											<div className={`flex ${is_sent ? "flex-row" : "flex-row-reverse"}`}>
												<div
													className={
														is_sent
															? "p-3 rounded-r-lg rounded-tl-lg bg-blue-500 text-white"
															: "p-3 rounded-l-lg rounded-tr-lg bg-gray-200 text-black"
													}
													key={index}
												>
													{message.content}
												</div>
											</div>
										</>
									)
								})}
							</div>

							<div className="m-3 flex flex-row">
								<input className="h-10 w-full rounded-xl bg-gray-100 focus:outline-none pl-2"></input>
							</div>
						</>
					) : (
						<div className="m-auto text-3xl font-semibold text-gray-500">No chat is selected</div>
					)}
				</div>
			</div>
		</>
	)
}
