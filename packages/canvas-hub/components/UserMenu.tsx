import { useContext, useState } from "react"
import ReactDOM from "react-dom"
import { usePopper } from "react-popper"
import toast from "react-hot-toast"
import { Popover } from "@headlessui/react"
import { AppContext } from "utils/client/AppContext"

export default function UserMenu() {
	const [referenceElement, setReferenceElement] = useState<HTMLButtonElement | null>(null)
	const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null)
	const { styles, attributes } = usePopper(referenceElement, popperElement, {
		placement: "bottom-end",
		strategy: "absolute",
		modifiers: [{ name: "arrow" }],
	})

	const { appBody } = useContext(AppContext)

	return (
		<Popover className="">
			<>
				<Popover.Button ref={setReferenceElement} className={`text-sm pt-0.25`}>
					Menu
				</Popover.Button>

				{appBody &&
					ReactDOM.createPortal(
						<Popover.Panel
							ref={setPopperElement}
							className="absolute z-10 bg-white border border-gray-200 rounded shadow w-28 mt-2"
							style={styles.popper}
							{...attributes.popper}
						>
							<div>
								<a
									className="block px-3 py-2 hover:bg-gray-100 text-sm border-b border-gray-200"
									href="#"
									onClick={() => toast("Unimplemented: logout")}
								>
									Logout
								</a>
							</div>
						</Popover.Panel>,
						appBody
					)}
			</>
		</Popover>
	)
}
