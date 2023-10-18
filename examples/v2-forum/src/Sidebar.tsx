import { useRef, useState, FormEvent } from "react"
import { ethers } from "ethers"
import { Canvas } from "@canvas-js/core"
import { useLiveQuery } from "@canvas-js/hooks"

import { Channel, Tag } from "./App"

import { Disclosure, Dialog } from "@headlessui/react"
import { ChevronRightIcon } from "@heroicons/react/20/solid"

export function CreateCategoryDialog({
	channel,
	isOpen,
	setIsOpen,
	app,
	wallet,
}: {
	channel: string
	isOpen: boolean
	setIsOpen: Function
	app: Canvas
	wallet: ethers.Wallet
}) {
	const channelInputRef = useRef<HTMLInputElement>(null)
	const createChannel = (e: FormEvent) => {
		e.preventDefault()
		if (!channelInputRef.current) return

		const channel = channelInputRef.current.value
		app?.actions
			.joinChannel({ address: wallet.address, channel })
			.then(() => {
				if (!channelInputRef.current) return
				channelInputRef.current.value = ""
				setIsOpen(false)
			})
			.catch((err) => console.log(err))
	}

	return (
		<Dialog open={isOpen} onClose={() => setIsOpen(false)}>
			<div className="fixed inset-0 flex w-screen items-center justify-center p-4">
				<Dialog.Panel className="w-full max-w-sm rounded bg-white px-6 py-6 shadow">
					<Dialog.Title>Create category</Dialog.Title>

					<form className="px-6 py-3" onSubmit={createChannel}>
						<input
							className="input mr-2 w-full"
							type="text"
							placeholder="Create a new category..."
							ref={channelInputRef}
						/>
						<button className="btn btn-blue w-full mt-2" type="submit">
							Create category
						</button>
					</form>
					{channel !== "all" && (
						<div className="px-6 py-3">
							<button
								className="btn btn-red w-full mb-2"
								type="submit"
								onClick={(e) => {
									e.preventDefault()
									app?.actions.leaveChannel({ channel })
								}}
							>
								Delete this category
							</button>
						</div>
					)}
				</Dialog.Panel>
			</div>
		</Dialog>
	)
}

export function CreateTagDialog({
	tag,
	isOpen,
	setIsOpen,
	app,
	wallet,
}: {
	tag: string
	isOpen: boolean
	setIsOpen: Function
	app: Canvas
	wallet: ethers.Wallet
}) {
	const tagInputRef = useRef<HTMLInputElement>(null)
	const createTag = (e: FormEvent) => {
		e.preventDefault()
		if (!tagInputRef.current) return

		const tag = tagInputRef.current.value
		app?.actions
			.createTag({ address: wallet.address, tag })
			.then(() => {
				if (!tagInputRef.current) return
				tagInputRef.current.value = ""
				setIsOpen(false)
			})
			.catch((err) => console.log(err))
	}

	return (
		<Dialog open={isOpen} onClose={() => setIsOpen(false)}>
			<div className="fixed inset-0 flex w-screen items-center justify-center p-4">
				<Dialog.Panel className="w-full max-w-sm rounded bg-white px-6 py-6 shadow">
					<Dialog.Title>Create tag</Dialog.Title>

					<form className="px-6 pb-3" onSubmit={createTag}>
						<input className="input mr-2 w-full" type="text" placeholder="Create a new tag..." ref={tagInputRef} />
						<button className="btn btn-blue w-full mt-2" type="submit">
							Create tag
						</button>
					</form>
					{tag !== "" && (
						<div className="px-6 py-3">
							<button
								className="btn btn-red w-full mb-2"
								type="submit"
								onClick={(e) => {
									app?.actions.deleteTag({ tag })
								}}
							>
								Delete this tag
							</button>
						</div>
					)}
				</Dialog.Panel>
			</div>
		</Dialog>
	)
}

export function Sidebar({
	thread,
	channel,
	tag,
	page,
	setThread,
	setChannel,
	setTag,
	setPage,
	app,
	wallet,
}: {
	thread: string
	channel: string
	tag: string
	page: number
	setThread: Function
	setChannel: Function
	setTag: Function
	setPage: Function
	app?: Canvas
	wallet: ethers.Wallet
}) {
	const tags = useLiveQuery<Tag>(app, "tags", {}) || []
	const channels = useLiveQuery<Channel>(app, "channels", {}) || []
	const displayedChannels = [{ name: "all" } as Channel].concat(channels)

	const [createCategoryOpen, setCreateCategoryOpen] = useState(false)
	const [createTagOpen, setCreateTagOpen] = useState(false)

	return (
		<>
			<CreateCategoryDialog
				app={app}
				wallet={wallet}
				channel={channel}
				isOpen={createCategoryOpen}
				setIsOpen={setCreateCategoryOpen}
			/>
			<CreateTagDialog app={app} wallet={wallet} tag={tag} isOpen={createTagOpen} setIsOpen={setCreateTagOpen} />
			<div className="fixed bg-white w-xl w-64 h-screen py-4 mr-8 border-r border-gray-200 flex flex-col">
				<div className="px-6 pb-3">
					<a
						href="#"
						className="font-semibold"
						onClick={(e) => {
							e.preventDefault()
							setThread("")
							setChannel("all")
							setPage(0)
						}}
					>
						My Forum
					</a>
				</div>
				<div className="pt-4 border-t border-gray-200">
					<Disclosure defaultOpen={true}>
						{({ open }) => (
							<>
								<Disclosure.Button className="px-6 py-1.5">
									Categories
									<ChevronRightIcon className={`inline-block w-5 h-5 -mt-0.5 ${open ? "rotate-90 transform" : ""}`} />
								</Disclosure.Button>
								<Disclosure.Panel>
									{displayedChannels.map((c) => (
										<div>
											<a
												href="#"
												className={`block px-6 py-1.5 hover:bg-gray-100 ${
													channel === c.name && !tag ? "bg-gray-100 font-semibold" : ""
												}`}
												key={c.name}
												onClick={(e) => {
													e.preventDefault()
													setThread("")
													setChannel(encodeURIComponent(c.name))
													setTag("")
													setPage(0)
												}}
											>
												{c.name === "all" ? "📚 All Posts" : c.name}
											</a>
										</div>
									))}
									<div>
										<a
											href="#"
											className={`block px-6 py-1.5 hover:bg-gray-100`}
											key={"create-tag"}
											onClick={(e) => {
												e.preventDefault()
												setCreateCategoryOpen(true)
											}}
										>
											+ Create category
										</a>
									</div>
								</Disclosure.Panel>
							</>
						)}
					</Disclosure>
				</div>
				<div className="pt-4">
					<Disclosure defaultOpen={true}>
						{({ open }) => (
							<>
								<Disclosure.Button className="px-6 py-1.5">
									Tags
									<ChevronRightIcon className={`inline-block w-5 h-5 -mt-0.5 ${open ? "rotate-90 transform" : ""}`} />
								</Disclosure.Button>
								<Disclosure.Panel>
									{tags
										.filter((t) => t.name !== "")
										.map((t) => (
											<div>
												<a
													href="#"
													className={`block px-6 py-1.5 hover:bg-gray-100 ${
														tag === t?.name ? "bg-gray-100 font-semibold" : ""
													}`}
													key={t.name}
													onClick={(e) => {
														e.preventDefault()
														setThread("")
														setChannel("")
														setTag(t.name)
														setPage(0)
													}}
												>
													{t.name}
												</a>
											</div>
										))}
									<div>
										<a
											href="#"
											className={`block px-6 py-1.5 hover:bg-gray-100`}
											key={"create-tag"}
											onClick={(e) => {
												e.preventDefault()
												setCreateTagOpen(true)
											}}
										>
											+ Create tag
										</a>
									</div>
								</Disclosure.Panel>
							</>
						)}
					</Disclosure>
				</div>
			</div>
		</>
	)
}
