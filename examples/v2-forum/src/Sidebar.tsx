import { useRef, useState, FormEvent } from "react"
import { ethers } from "ethers"
import { Canvas } from "@canvas-js/core"
import { useLiveQuery } from "@canvas-js/hooks"

import { Category, Tag } from "./App"

import { Disclosure, Dialog, Menu } from "@headlessui/react"
import { ChevronRightIcon, ChevronDownIcon } from "@heroicons/react/20/solid"

export function CreateCategoryDialog({
	category,
	isOpen,
	setIsOpen,
	app,
	wallet,
}: {
	category: string
	isOpen: boolean
	setIsOpen: (arg0: boolean) => void
	app?: Canvas
	wallet: ethers.Wallet
}) {
	const categoryInputRef = useRef<HTMLInputElement>(null)
	const createCategory = (e: FormEvent) => {
		e.preventDefault()
		if (!categoryInputRef.current) return

		const category = categoryInputRef.current.value
		app?.actions
			.createCategory({ category })
			.then(() => {
				if (!categoryInputRef.current) return
				categoryInputRef.current.value = ""
				setIsOpen(false)
			})
			.catch((err) => console.log(err))
	}

	return (
		<Dialog open={isOpen} onClose={() => setIsOpen(false)}>
			<div className="fixed inset-0 flex w-screen items-center justify-center p-4">
				<Dialog.Panel className="w-full max-w-sm rounded bg-white px-6 py-6 shadow">
					<Dialog.Title>Create category</Dialog.Title>

					<form className="px-6 py-3" onSubmit={createCategory}>
						<input
							className="input mr-2 w-full"
							type="text"
							placeholder="Create a new category..."
							ref={categoryInputRef}
						/>
						<button className="btn btn-blue w-full mt-2" type="submit">
							Create category
						</button>
					</form>
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
	setIsOpen: (arg0: boolean) => void
	app?: Canvas
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
				</Dialog.Panel>
			</div>
		</Dialog>
	)
}

export function Sidebar({
	category,
	tag,
	setThread,
	setCategory,
	setTag,
	setPage,
	app,
	wallet,
}: {
	category: string
	tag: string
	setThread: (arg0: string) => void
	setCategory: (arg0: string) => void
	setTag: (arg0: string) => void
	setPage: (arg0: number) => void
	app?: Canvas
	wallet: ethers.Wallet
}) {
	const tags = useLiveQuery<Tag>(app, "tags", {}) || []
	const categories = useLiveQuery<Category>(app, "categories", {}) || []

	const [createCategoryOpen, setCreateCategoryOpen] = useState(false)
	const [createTagOpen, setCreateTagOpen] = useState(false)

	return (
		<>
			<CreateCategoryDialog
				app={app}
				wallet={wallet}
				category={category}
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
							setCategory("all")
							setPage(0)
						}}
					>
						My Forum
					</a>
				</div>
				<div className="pt-4 border-t border-gray-200">
					<div className="pb-4">
						<a
							href="#"
							className={`block px-6 py-1.5 hover:bg-gray-100 ${
								category === "all" && !tag ? "bg-gray-100 font-semibold" : ""
							}`}
							key="all"
							onClick={(e) => {
								e.preventDefault()
								setThread("")
								setCategory("all")
								setTag("")
								setPage(0)
							}}
						>
							All Posts
						</a>
					</div>
					<Disclosure defaultOpen={true}>
						{({ open }) => (
							<>
								<Disclosure.Button className="px-6 py-1.5 w-full text-left">
									Categories
									<ChevronRightIcon className={`inline-block w-5 h-5 -mt-0.5 ${open ? "rotate-90 transform" : ""}`} />
								</Disclosure.Button>
								<Disclosure.Panel>
									{categories.map((c) => (
										<div className="relative group" key={c.name}>
											<a
												href="#"
												className={`block px-6 py-1.5 hover:bg-gray-100 ${
													category === c.name && !tag ? "bg-gray-100 font-semibold" : ""
												}`}
												key={c.name}
												onClick={(e) => {
													e.preventDefault()
													setThread("")
													setCategory(encodeURIComponent(c.name))
													setTag("")
													setPage(0)
												}}
											>
												{c.name}
											</a>
											<Menu>
												<Menu.Button className="absolute invisible group-hover:visible top-0 right-2 bg-gray-200 rounded-lg w-6 mt-1.5 z-9">
													<ChevronDownIcon className={`inline-block w-5 h-5 -mt-0.5`} />
												</Menu.Button>
												<Menu.Items className="absolute right-0 mt-0.5 mr-2 bg-white z-10 shadow">
													<Menu.Item>
														{({ active }) => (
															<a
																className={`px-3 py-2 inline-block rounded-lg ${active && "bg-blue-300"}`}
																href="#"
																onClick={() => {
																	if (confirm("Really delete this category?")) {
																		app?.actions.deleteCategory({ category: c.name })
																	}
																}}
															>
																Delete category
															</a>
														)}
													</Menu.Item>
												</Menu.Items>
											</Menu>
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
								<Disclosure.Button className="px-6 py-1.5 w-full text-left">
									Tags
									<ChevronRightIcon className={`inline-block w-5 h-5 -mt-0.5 ${open ? "rotate-90 transform" : ""}`} />
								</Disclosure.Button>
								<Disclosure.Panel>
									{tags
										.filter((t) => t.name !== "")
										.map((t) => (
											<div className="relative group" key={t.name}>
												<a
													href="#"
													className={`block px-6 py-1.5 hover:bg-gray-100 ${
														tag === t?.name ? "bg-gray-100 font-semibold" : ""
													}`}
													key={t.name}
													onClick={(e) => {
														e.preventDefault()
														setThread("")
														setCategory("")
														setTag(t.name)
														setPage(0)
													}}
												>
													{t.name}
												</a>
												<Menu>
													<Menu.Button className="absolute invisible group-hover:visible top-0 right-2 bg-gray-200 rounded-lg w-6 mt-1.5 z-9">
														<ChevronDownIcon className={`inline-block w-5 h-5 -mt-0.5`} />
													</Menu.Button>
													<Menu.Items className="absolute right-0 mt-0.5 mr-2 bg-white z-10 shadow">
														<Menu.Item>
															{({ active }) => (
																<a
																	className={`px-3 py-2 inline-block rounded-lg ${active && "bg-blue-300"}`}
																	href="#"
																	onClick={(e) => {
																		if (confirm("Really delete this tag?")) {
																			app?.actions.deleteTag({ tag: t.name })
																		}
																	}}
																>
																	Delete tag
																</a>
															)}
														</Menu.Item>
													</Menu.Items>
												</Menu>
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
