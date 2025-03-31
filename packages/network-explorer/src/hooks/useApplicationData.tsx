import useSWR from "swr"

import { fetchAndIpldParseJson } from "../utils.js"
import React, { createContext, useContext, useEffect, useState } from "react"
import { ApplicationData } from "@canvas-js/core"

type ApplicationDataWithRefetch = ApplicationData & { refetch: () => Promise<any> }

const ApplicationDataContext = createContext<ApplicationDataWithRefetch | null>(null)

export const ApplicationDataProvider = ({ children }: { children: React.ReactNode }) => {
	const [content, setContent] = useState<ApplicationData | null>(null)
	const { data, mutate } = useSWR(`/api/`, fetchAndIpldParseJson<ApplicationData>)

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
		<ApplicationDataContext.Provider value={content ? { ...content, refetch } : null}>
			{children}
		</ApplicationDataContext.Provider>
	)
}

export const useApplicationData = () => useContext(ApplicationDataContext)
