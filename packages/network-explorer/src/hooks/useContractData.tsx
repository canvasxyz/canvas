import useSWR from "swr"

import { fetchAndIpldParseJson } from "../utils.js"
import React, { createContext, useContext, useEffect, useState } from "react"

type ContractData = {
	contract: string
}

const ContractDataContext = createContext<ContractData | null>(null)

export const ContractDataProvider = ({ children }: { children: React.ReactNode }) => {
	const [content, setContent] = useState<ContractData | null>(null)
	const { data } = useSWR(`/api/contract`, fetchAndIpldParseJson<ContractData>)

	useEffect(() => {
		if (data && data.content) {
			setContent(data.content)
		} else {
			setContent(null)
		}
	}, [data])

	return <ContractDataContext.Provider value={content}>{children}</ContractDataContext.Provider>
}

export const useContractData = () => useContext(ContractDataContext)
