import React from "react"

export const ErrorMessage: React.FC<{ error: Error | null }> = ({ error }) => {
	if (error === null) {
		return null
	} else if (isErrorCode(error)) {
		return (
			<p>
				{error.name}: {error.code}
			</p>
		)
	} else {
		return (
			<p>
				{error.name}: {error.message}
			</p>
		)
	}
}

const isErrorCode = (error: Error): error is Error & { code: string } => {
	return "code" in error
}
