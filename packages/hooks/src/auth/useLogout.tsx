import React, { useState, useCallback, useContext } from "react"
import type { Canvas } from "@canvas-js/core"
import { AuthContext } from "./AuthContext.js"

import { styles } from "./styles.js"

export interface LogoutProps {
	buttonStyles?: React.CSSProperties
	buttonClassName?: string
	label?: string
}

export const useLogout = (app?: Canvas) => {
	const { sessionSigner, setSessionSigner, address, setAddress } = useContext(AuthContext)

	const logout = useCallback(async () => {
		if (!app) return

		await Promise.all(app.signers.getAll().map((signer) => signer.clearSession(app.topic)))
		setAddress(null)
		setSessionSigner(null)
	}, [app])

	const Logout = ({ buttonStyles, buttonClassName, label }: LogoutProps) => {
		return (
			<button
				onClick={() => logout()}
				className={buttonClassName || ""}
				style={{
					...styles.actionButton,
					...buttonStyles,
				}}
			>
				{label ?? "Logout"}
			</button>
		)
	}

	return {
		logout,
		Logout,
	}
}
