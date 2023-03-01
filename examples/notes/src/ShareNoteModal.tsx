import React, { useState } from "react"
import { LocalNote, User } from "./models"

export const ShareNoteModal = ({
	currentNote,
	users,
	closeModal,
	shareNote,
}: {
	currentNote: LocalNote
	users: Record<string, User>
	closeModal: () => void
	shareNote: (otherUser: User, note: LocalNote) => void
}) => {
	const usersList = Object.entries(users)

	return (
		<div className="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
			<div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

			<div className="fixed inset-0 z-10 overflow-y-auto">
				<div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
					<div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
						<div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
							<div className="sm:flex sm:items-start">
								<div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
									<h3 className="text-base font-semibold leading-6 text-gray-900" id="modal-title">
										Share note {currentNote.id}
									</h3>
									<div className="mt-2">
										<p className="text-sm text-gray-500">
											<li>
												{usersList.map(([id, user]) => (
													<ul
														key={user.id}
														onClick={async () => {
															shareNote(user, currentNote)
														}}
													>
														{user.address}
													</ul>
												))}
											</li>
										</p>
									</div>
								</div>
							</div>
						</div>
						<div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
							<button
								type="button"
								onClick={closeModal}
								className="inline-flex w-full justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
							>
								Share
							</button>
							<button
								type="button"
								onClick={closeModal}
								className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
							>
								Cancel
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
