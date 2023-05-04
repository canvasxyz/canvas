import React from "react"
import { LocalNote, User } from "./models"

export const ShareNoteModal = ({
	address,
	currentNote,
	users,
	createdByCurrentUser,
	closeModal,
	shareNote,
	owners,
}: {
	address: string
	currentNote: LocalNote
	users: Record<string, User>
	createdByCurrentUser: boolean
	closeModal: () => void
	shareNote: (otherUser: User, note: LocalNote) => void
	// users who already have access to the note
	owners: string[]
}) => {
	const usersList = Object.entries(users)
	const otherUsers = usersList.filter(([idx, user]) => user.address !== address)

	return (
		<div className="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
			<div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

			<div className="fixed inset-0 z-10 overflow-y-auto">
				<div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
					<div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
						<div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
							{/* <div className="sm:flex sm:items-start"> */}
							<div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
								<h3 className="text-base font-semibold leading-6 text-gray-900" id="modal-title">
									Share note "{currentNote.id.split("/")[1].slice(0, 10)}..."
								</h3>

								<div className="mt-2 flex flex-col gap-2">
									{!createdByCurrentUser && (
										<div className="text-sm text-red-500 justify-center italic">
											Notes can only be shared by their creator
										</div>
									)}
									{otherUsers.map(([id, user]) => (
										<div key={`user-${user.address}`} className="grid grid-cols-6 gap-2">
											<div className="grid col-span-5 py-2 truncate">{user.address.slice(0, 20)}...</div>
											{owners.includes(user.address) ? (
												<button
													key={user.id}
													className="grid mt-3 col-span-1 w-full justify-center rounded-md border border-gray-200 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
													disabled={true}
												>
													Shared
												</button>
											) : createdByCurrentUser ? (
												<button
													key={user.id}
													onClick={async () => {
														shareNote(user, currentNote)
													}}
													className="grid mt-3 col-span-1 w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
												>
													Share
												</button>
											) : (
												<></>
											)}
										</div>
									))}
								</div>
							</div>
						</div>
						<div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
							<button
								type="button"
								onClick={closeModal}
								className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
							>
								Close
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
