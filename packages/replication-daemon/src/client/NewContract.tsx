import React, { useCallback, useContext, useState } from "react"

import { AppContext } from "./AppContext.js"
import { Editor } from "./Editor.js"
import { contractTemplate } from "./contract.js"
import { host } from "./API.js"

const initialValue = contractTemplate()

export const NewContract: React.FC<{}> = ({}) => {
	const { state, select } = useContext(AppContext)

	const [contract, setContract] = useState<string>(initialValue)

	const submit = useCallback(
		async (contract: string) => {
			const res = await fetch(`${host}/api/apps`, { method: "post", body: contract })
			if (res.status !== 200) {
				const message = await res.text()
				alert(`failed to start app (${res.status} ${res.statusText}) ${message}`)
			}

			const location = res.headers.get("location")
			if (location !== null && location.startsWith("#")) {
				const topic = location.slice(1)
				select(topic)
			}
		},
		[state],
	)

	return (
		<div className="p-2 flex flex-col gap-2">
			<div className="flex-1">
				<Editor initialValue={initialValue} onChange={(state) => setContract(state.doc.toString())} />
			</div>
			<div className="flex flex-col items-stretch">
				<button
					key="start"
					className="p-2 border rounded bg-gray-100 hover:border-gray-400 active:bg-white"
					onClick={() => submit(contract)}
				>
					Create
				</button>
			</div>
		</div>
	)
}
