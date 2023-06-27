import React, { useCallback, useContext, useMemo, useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { useEnsName } from "wagmi"
import _ from "lodash"

import { PrivateUserRegistration, PublicUserRegistration, getPublicUserRegistration } from "../../shared/index.js"
import { db } from "../db.js"
import { AppContext } from "../AppContext.js"
import { createRoom } from "../stores.js"

interface UserEntryProps {
	user: PublicUserRegistration
	disabled?: boolean
	isSelected: boolean
	onClick: () => void
}

const UserEntry = ({ user, onClick, isSelected, disabled }: UserEntryProps) => {
	const { data: ensName } = useEnsName({ address: user.address })
	return (
		<button
			onClick={onClick}
			disabled={disabled}
			className="grid mt-3 col-span-1 w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
		>
			{isSelected && "✓ "}
			{user.address} ({ensName ?? "..."})
		</button>
	)
}

export interface NewChatModalProps {
	creator: PrivateUserRegistration
	onClose: () => void
}

export const NewChatModal = ({ creator, onClose }: NewChatModalProps) => {
	const users = useLiveQuery(() => db.users.toArray(), []) ?? []

	const [members, setMembers] = useState<PublicUserRegistration[]>([getPublicUserRegistration(creator)])

	const startNewChat = useCallback(async () => {
		if (members.length === 0) {
			return
		}

		console.log("starting new chat with", members)

		try {
			createRoom(members, creator)
			onClose()
		} catch (err) {
			if (err instanceof Error) {
				console.error("failed to create room", err)
				alert(err.toString())
			} else {
				throw err
			}
		}
	}, [creator, members])

	const handleClick = useCallback(
		(user: PublicUserRegistration) => {
			if (user.address === creator.address) {
				return
			}

			const member = members.find(({ address }) => user.address === address)
			if (member === undefined) {
				setMembers([...members, user])
			} else {
				setMembers(members.filter(({ address }) => address !== user.address))
			}
		},
		[creator, members]
	)

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
									{users.map((user) => (
										<UserEntry
											key={user.address}
											user={user}
											isSelected={
												user.address === creator.address || members.some(({ address }) => user.address === address)
											}
											onClick={() => handleClick(user)}
										/>
									))}
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
								onClick={onClose}
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
