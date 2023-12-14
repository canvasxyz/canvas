import React, { useCallback, useEffect, useRef, useState } from "react"

import { host, type API } from "./API.js"

import { AppList } from "./AppList.js"
import { AppContext } from "./AppContext.js"
import { ContractView } from "./ContractView.js"
import { NewContract } from "./NewContract.js"
import { ConnectionStatus } from "./ConnectionStatus.js"

export const App: React.FC<{}> = ({}) => {
	const [state, setState] = useState<null | API["/api/state"]>(null)

	const [selected, setSelected] = useState<null | { topic: string; contract: string }>(null)

	const select = useCallback(async (topic: string) => {
		const contract = await fetch(`${host}/api/apps/${topic}`).then((res) => res.text())
		setSelected({ topic, contract })
	}, [])

	const refresh = useCallback(async () => {
		try {
			const state: API["/api/state"] = await fetch(`${host}/api/state`).then((res) => res.json())
			state.apps.sort(({ topic: a }, { topic: b }) => (a < b ? -1 : a === b ? 0 : 1))
			setState(state)
		} catch (err) {
			console.error(err)
		}
	}, [])

	const refreshInterval = useRef<NodeJS.Timeout | null>(null)
	useEffect(() => {
		if (refreshInterval.current !== null) {
			return
		}

		refreshInterval.current = setInterval(refresh, 1000)
		refresh()
	}, [])

	return (
		<AppContext.Provider value={{ state, selected, select }}>
			<div className="w-full h-full bg-stone-100 overflow-x-scroll">
				<div className="h-full flex items-stretch">
					<div className="w-[18rem] min-w-[18rem] overflow-y-scroll border-r border-stone-200">
						<div
							className="p-2 select-none border-b border-t border-stone-300 bg-violet-200 cursor-pointer hover:bg-violet-100 active:bg-white"
							onClick={() => setSelected(null)}
						>
							New app
						</div>
						<AppList />
					</div>
					<div>{selected === null ? <NewContract /> : <ContractView {...selected} />}</div>
					<div className="w-[512px] p-2 border-l border-stone-300">
						<ConnectionStatus />
					</div>
				</div>
			</div>
		</AppContext.Provider>
	)
}
