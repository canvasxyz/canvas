import { useCallback, useEffect, useMemo, useState } from "react"
import ReactDOM from "react-dom"
import { usePopper } from "react-popper"
import toast from "react-hot-toast"
import { Popover } from "@headlessui/react"

import dynamic from "next/dynamic"
import useSWR from "swr"

import ProjectMenu from "./ProjectMenu"
import { StatusCodes } from "http-status-codes"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

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

interface SidebarMenuItemProps {
	active: boolean
	running: boolean
	multihash: string
}

function SidebarMenuItem({ active, multihash, running }: SidebarMenuItemProps) {
	const [shouldBeRunning, setShouldBeRunning] = useState<boolean>(running)
	useEffect(() => {
		setShouldBeRunning(running)
	}, [running])

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

	const startApp = useCallback(
		(close) => {
			console.log("starting app", multihash)
			fetch(`/api/instance/${multihash}/start`, { method: "PUT" }).then((res) => {
				if (res.status !== StatusCodes.OK) {
					toast.error("Could not start app")
					setShouldBeRunning(running)
				}
			})
			setShouldBeRunning(true)
			close()
		},
		[multihash]
	)

	const stopApp = useCallback(
		(close) => {
			console.log("stopping app", multihash)
			fetch(`/api/instance/${multihash}/stop`, { method: "PUT" }).then((res) => {
				if (res.status !== StatusCodes.OK) {
					toast.error("Could not stop app")
					setShouldBeRunning(running)
				}
			})
			setShouldBeRunning(false)
			close()
		},
		[multihash]
	)

	return (
		<Popover className={`border-l ${active ? "border-gray-400" : "border-gray-200"}`}>
			<Popover.Button
				ref={setReferenceElement}
				className={`flex-0 text-sm px-2 pb-5 flex gap-4 hover:bg-gray-100 cursor-pointer border-t outline-none ${
					active ? "!bg-blue-500 text-white" : ""
				} ${shouldBeRunning !== running ? "pointer-events-none " : ""}`}
			>
				<span
					className={`relative text-xl top-1 leading-3 ${active ? "text-gray-100" : "text-gray-400"} ${
						shouldBeRunning !== running ? "opacity-50" : ""
					}`}
				>
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
					{({ close }) => (
						<div>
							{running ? (
								<button
									className="block w-full text-left px-3 py-2 hover:bg-gray-100 text-sm border-b border-gray-200"
									onClick={stopApp.bind(null, close)}
								>
									Stop
								</button>
							) : (
								<button
									className="block w-full text-left px-3 py-2 hover:bg-gray-100 text-sm border-b border-gray-200"
									onClick={startApp.bind(null, close)}
								>
									Start
								</button>
							)}
						</div>
					)}
				</Popover.Panel>,
				document.querySelector(".app-body")!
			)}
		</Popover>
	)
}

function Sidebar({ version_number, app, edited }: SidebarProps) {
	const { data, error } = useSWR("/api/instance", fetcher, { refreshInterval: 1000 })
	const instances = useMemo<Record<string, { models: Record<string, Record<string, string>> }>>(
		() => data || {},
		[data]
	)

	return (
		<div className="">
			<div className="font-semibold mb-3">
				Projects <span className="text-gray-400 mx-0.25">/</span> {app.slug}
				<ProjectMenu app={app} />
			</div>
			<div className="border rounded overflow-hidden w-60">
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
				{app.versions.map((version) => {
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
								{version.multihash in instances ? (
									<div className="inline-block rounded px-1.5 py-0.5 mr-2 text-xs bg-green-600 text-white">Running</div>
								) : (
									<div className="inline-block rounded px-1.5 py-0.5 mr-2 text-xs bg-red-500 text-white">Stopped</div>
								)}
								<span
									className={`text-gray-400 font-mono text-xs mt-0.5 ${
										version.version_number === version_number ? "!text-gray-100" : ""
									}`}
								>
									{version.multihash.slice(0, 6)}
								</span>
							</a>
							<SidebarMenuItem
								multihash={version.multihash}
								active={version.version_number === version_number}
								running={version.multihash in instances}
							/>
						</div>
					)
				})}
			</div>
		</div>
	)
}

export default dynamic(async () => Sidebar, { ssr: false })
