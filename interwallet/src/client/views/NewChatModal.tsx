import React, { useCallback, useContext, useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { useEnsName } from "wagmi"
import _ from "lodash"
import {
	PrivateUserRegistration,
	PublicUserRegistration,
	RoomRegistration,
	getPublicUserRegistration,
} from "../../shared/index.js"
import { InterwalletChatDB } from "../db.js"
import { ChatContext } from "./ChatContext.js"

interface UserEntryProps {
	user: PublicUserRegistration
	onClick: () => void
	isSelected: boolean
}

const UserEntry = ({ user, onClick, isSelected }: UserEntryProps) => {
	const { data: ensName } = useEnsName({ address: user.address })
	return (
		<button
			onClick={onClick}
			className="grid mt-3 col-span-1 w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
		>
			{isSelected && "✓ "}
			{ensName} ({user.address.slice(0, 8)}...)
		</button>
	)
}

export interface NewChatModalProps {
	closeModal: () => void
}

export const NewChatModal = ({ closeModal }: NewChatModalProps) => {
	const { db, createRoom, user } = useContext(ChatContext)

	const users = useLiveQuery(async () => await db.users.toArray(), [])
	const [selectedRecipients, setSelectedRecipients] = useState<Record<string, boolean>>({})

	const startNewChat = useCallback(async () => {
		const selectedRecipientAddresses = Object.keys(selectedRecipients)
		if (selectedRecipientAddresses.length === 0) {
			return
		}

		console.log("starting new chat with", selectedRecipientAddresses)

		const selectedRecipientsObjects = users?.filter((user) => selectedRecipientAddresses.includes(user.address)) || []
		if (selectedRecipientsObjects.length === 0) {
			return
		}

		try {
			// sort the members so that only one room is created for any two users
			const members = _.sortBy(
				[getPublicUserRegistration(user), ...selectedRecipientsObjects],
				(member) => member.address
			)
			await createRoom({ members, creator: user.address })
		} catch (err) {
			console.error("failed to create room", err)
		}
		closeModal()
	}, [user, selectedRecipients])

	return (
		<div className="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
			<div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

			<div className="fixed inset-0 z-10 overflow-y-auto">
				<div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
					<div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
						<div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
							<div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
								<h3 className="text-base font-semibold leading-6 text-gray-900" id="modal-title">
									New conversation
								</h3>

								<div className="mt-2 flex flex-col gap-2">
									{users?.map((recipient) =>
										recipient.address === user?.address ? null : (
											<UserEntry
												key={recipient.address}
												user={recipient}
												isSelected={selectedRecipients[recipient.address] === true}
												onClick={() => {
													if (selectedRecipients[recipient.address] === true) {
														setSelectedRecipients({ ...selectedRecipients, [recipient.address]: false })
													} else {
														setSelectedRecipients({ ...selectedRecipients, [recipient.address]: true })
													}
												}}
											/>
										)
									)}
								</div>
							</div>
						</div>
						<div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row sm:px-6">
							<button
								type="button"
								onClick={() => startNewChat()}
								className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
							>
								Start chat
							</button>
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
