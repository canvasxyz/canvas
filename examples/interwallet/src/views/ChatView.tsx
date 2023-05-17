import React from "react"

import { UserRegistration } from "../interfaces"
// import { NewChatModal } from "./NewChatModal"
import { ChatSidebar } from "./ChatSidebar"
import { Messages } from "./Messages"
import { useEnsName } from "wagmi"

export const ChatView: React.FC<{
	user: UserRegistration
}> = ({ user }) => {
	// const [showUserList, setShowUserList] = React.useState<boolean>(false)
	const now = new Date()

	const [currentUserAddress, setCurrentUserAddress] = React.useState<string | null>(null)

	const users = [
		{
			address: "0x2AdC396D8092D79Db0fA8a18fa7e3451Dc1dFB37",
		},
		{
			address: "0xBAfb51e8b95ad343Bfe79b2F7d32FCa27a74db0c",
		},
	]

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
	const { data } = useEnsName({ address: currentUserAddress as `0x${string}` })
	console.log(data)

	return (
		<>
			<div className="flex flex-row h-screen overflow-hidden bg-white">
				{/* sidebar */}
				<ChatSidebar currentUserAddress={currentUserAddress} selectUser={setCurrentUserAddress} users={users} />
				{/* main content */}
				<div className="overflow-y-auto overflow-x-hidden relative flex flex-col grow">
					{/* top bar? */}
					<div className="h-16 p-3 font-bold text-lg flex items-center">{data}</div>
					{true ? (
						<>
							<Messages messages={messages} />
							<div className="m-3 flex flex-row">
								<input className="h-10 w-full rounded-xl bg-gray-100 focus:outline-none pl-2"></input>
							</div>
						</>
					) : (
						<div className="m-auto text-3xl font-semibold text-gray-500">No chat is selected</div>
					)}
				</div>
			</div>
			{/* {showUserList && (
				<NewChatModal
					closeModal={() => {
						setShowUserList(false)
					}}
					selectUser={startChat}
					userRegistrations={userRegistrations}
				/>
			)} */}
		</>
	)
}
