import useSWR from "swr"

import { fetchAndIpldParseJson } from "../utils.js"
import React, { createContext, useContext, useEffect, useState } from "react"

type ContractData = {
	inMemory: boolean
	originalContract: string
	contract: string
	admin: boolean
	nonce: string
	refetch: () => Promise<any>
}

const ContractDataContext = createContext<ContractData | null>(null)

export const ContractDataProvider = ({ children }: { children: React.ReactNode }) => {
	const [content, setContent] = useState<Omit<ContractData, "refetch"> | null>(null)
	const { data, mutate } = useSWR(`/api/contract`, fetchAndIpldParseJson<ContractData>)

	useEffect(() => {
		if (data && data.content) {
			setContent(data.content)
		} else {
			setContent(null)
		}
	}, [data])

	// Function to trigger a refetch
	const refetch = async () => {
		return mutate()
	}

	return (
		<ContractDataContext.Provider value={content ? { ...content, refetch } : null}>
			{children}
		</ContractDataContext.Provider>
	)
}

export const useContractData = () => useContext(ContractDataContext)
