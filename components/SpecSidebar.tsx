import { useState } from "react"
import ReactDOM from "react-dom"
import { usePopper } from "react-popper"
import { Popover } from "@headlessui/react"
import dynamic from "next/dynamic"

interface SidebarProps {
	version_number: null | number
	app: {
		slug: string
		draft_spec: string
		versions: {
			multihash: string
			version_number: number
			spec: string
		}[]
	}
	edited: boolean
}

interface SidebarMenuProps {
	active: boolean
}

function SidebarMenu({ active }: SidebarMenuProps) {
	const [referenceElement, setReferenceElement] = useState<HTMLButtonElement | null>(null)
	const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null)
	const { styles, attributes } = usePopper(referenceElement, popperElement, {
		placement: "bottom-end",
		strategy: "absolute",
		modifiers: [
			{
				name: "arrow",
			},
		],
	})

	return (
		<Popover className={`border-l ${active ? "border-gray-400" : "border-gray-200"}`}>
			<Popover.Button
				ref={setReferenceElement}
				className={`flex-0 text-sm px-2 pb-5 flex gap-4 hover:bg-gray-100 cursor-pointer border-t outline-none ${
					active ? "!bg-blue-500 text-white" : ""
				}`}
			>
				<span className={`relative text-xl top-1 leading-3 ${active ? "text-gray-100" : "text-gray-400"}`}>
					&hellip;
				</span>
			</Popover.Button>

			{ReactDOM.createPortal(
				<Popover.Panel
					ref={setPopperElement}
					className="absolute z-10 bg-white border border-gray-200 rounded shadow w-28"
					style={styles.popper}
					{...attributes.popper}
				>
					<div>
						<a
							className="block px-3 py-2 hover:bg-gray-100 text-sm border-b border-gray-200"
							href="#"
							onClick={() => alert("unimplemented: start")}
						>
							Start
						</a>
						{/*<a className="block px-3 py-2 hover:bg-gray-100 text-sm" href="#" onClick={() => alert("unimplemented: stop")}>
							Stop
						  </a>*/}
					</div>
				</Popover.Panel>,
				document.querySelector(".app-body")!
			)}
		</Popover>
	)
}

function Sidebar({ version_number, app, edited }: SidebarProps) {
	return (
		<div className="">
			<div className="font-semibold mb-3">
				Projects <span className="text-gray-400 mx-0.25">/</span> {app.slug}
			</div>
			<div className="border rounded overflow-hidden">
				<div className="flex">
					<a
						className={`flex-1 text-sm px-3 py-1.5 flex gap-4 hover:bg-gray-100 ${
							version_number === null ? "!bg-blue-500 text-white" : ""
						}`}
						href="?"
					>
						<span className={`flex-1`}>Latest</span>
						{edited && <span className="text-gray-400">Edited</span>}
					</a>
				</div>
				{app.versions.map((version, index) => {
					return (
						<div key={version.multihash} className="flex">
							<a
								key={version.version_number}
								className={`flex-1 text-sm px-3 py-1.5 flex gap-4 hover:bg-gray-100 border-t ${
									version.version_number === version_number ? "!bg-blue-500 text-white" : ""
								}`}
								href={`?version=v${version.version_number}`}
							>
								<span className={`flex-1`}>v{version.version_number}</span>
								{index === 1 /* TODO */ && (
									<div className="inline-block rounded px-1.5 py-0.5 mr-2 text-xs bg-green-600 text-white">Running</div>
								)}
								<span
									className={`text-gray-400 font-mono text-xs mt-0.5 ${
										version.version_number === version_number ? "!text-gray-100" : ""
									}`}
								>
									{version.multihash.slice(0, 6)}
								</span>
							</a>
							<SidebarMenu active={version.version_number === version_number} />
						</div>
					)
				})}
			</div>
		</div>
	)
}

export default dynamic(async () => Sidebar, { ssr: false })
