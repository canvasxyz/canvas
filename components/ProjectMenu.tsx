import { useState, useCallback } from "react"
import ReactDOM from "react-dom"
import { usePopper } from "react-popper"
import toast from "react-hot-toast"
import { Popover } from "@headlessui/react"

import Link from "next/link"
import dynamic from "next/dynamic"
import { useRouter } from "next/router"
import { StatusCodes } from "http-status-codes"

interface ProjectMenuProps {
	app: {
		slug: string
		draft_spec: string
		versions: {
			multihash: string
			version_number: number
			spec: string
		}[]
	}
}

function ProjectMenu({ app }: ProjectMenuProps) {
	const router = useRouter()
	const [referenceElement, setReferenceElement] = useState<HTMLButtonElement | null>(null)
	const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null)
	const { styles, attributes } = usePopper(referenceElement, popperElement, {
		placement: "bottom-start",
		strategy: "absolute",
		modifiers: [
			{
				name: "arrow",
			},
		],
	})

	const deleteApp = useCallback(() => {
		if (!confirm("Really delete this app?")) return

		fetch(`/api/app/${app.slug}`, {
			method: "DELETE",
		}).then((res) => {
			if (res.status === StatusCodes.OK) {
				router.push("/")
				toast("App deleted.")
			} else {
				toast("Error deleting project.")
			}
		})
	}, [app])

	return (
		<Popover className="inline text-sm">
			<Popover.Button
				ref={setReferenceElement}
				className={`bg-gray-200 hover:bg-gray-300 inline-block px-1.5 py-1 ml-2 rounded`}
			>
				<span className="inline-block relative -top-0.5">&hellip;</span>
			</Popover.Button>

			{ReactDOM.createPortal(
				<Popover.Panel
					ref={setPopperElement}
					className="absolute z-10 bg-white border border-gray-200 rounded shadow w-28 mt-2"
					style={styles.popper}
					{...attributes.popper}
				>
					<button
						className="block w-full text-left px-3 py-2 hover:bg-gray-100 text-sm border-b border-gray-200"
						onClick={deleteApp}
					>
						Delete
					</button>
				</Popover.Panel>,
				document.querySelector(".app-body")!
			)}
		</Popover>
	)
}
export default dynamic(async () => ProjectMenu, { ssr: false })
