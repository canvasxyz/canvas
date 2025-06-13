import React, { createContext, useState, ReactNode } from "react"
import { SessionSigner } from "@canvas-js/interfaces"

interface AuthContextType {
	sessionSigner: SessionSigner | null
	setSessionSigner: (signer: SessionSigner | null) => void
	address: string | null
	setAddress: (address: string | null) => void
}

export const AuthContext = createContext<AuthContextType>({
	sessionSigner: null,
	setSessionSigner: () => {
		throw new Error('AuthProvider not initialized, useSIWE/useSIWF must be called inside the AuthProvider.')
	},
	address: null,
	setAddress: () => {
		throw new Error('AuthProvider not initialized, useSIWE/useSIWF must be called inside the AuthProvider.')
	},
})

interface AuthProviderProps {
	children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
	const [sessionSigner, setSessionSigner] = useState<SessionSigner | null>(null)
	const [address, setAddress] = useState<string | null>(null)

	return (
		<AuthContext.Provider value={{ sessionSigner, setSessionSigner, address, setAddress }}>
			{children}
		</AuthContext.Provider>
	)
}