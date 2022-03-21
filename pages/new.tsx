import { StatusCodes } from "http-status-codes"
import { useRouter } from "next/router"
import React, { useCallback, useState } from "react"

import { alphanumeric } from "utils/shared/regexps"

interface NewPageProps {}

export default function NewPage({}: NewPageProps) {
	const router = useRouter()
	const [loading, setLoading] = useState(false)

	const handleSubmit = useCallback(
		(slug: string) => {
			setLoading(true)
			fetch("/api/app", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ slug }),
			}).then((res) => {
				if (res.status === StatusCodes.CREATED) {
					const location = res.headers.get("Location")
					if (location !== null) {
						router.push(location)
					}
				}
			})
		},
		[loading]
	)

	const [slug, setSlug] = useState("")

	const disabled = loading || !alphanumeric.test(slug)

	return (
		<div className="max-w-xl my-8 mx-auto">
			<h1 className="text-3xl my-2">New Project</h1>
			<div className="border rounded bg-white px-2">
				<div className="my-2 flex gap-2">
					<label>Name</label>
					<input
						className="border w-72"
						type="text"
						placeholder={alphanumeric.source}
						value={slug}
						onChange={({ target: { value } }) => setSlug(value)}
					/>
				</div>

				<button
					className={
						disabled
							? "block w-full my-2 p-2 rounded bg-gray-300 text-center text-white cursor-not-allowed"
							: "block w-full my-2 p-2 rounded bg-blue-600 text-center text-white cursor-pointer"
					}
					onClick={() => handleSubmit(slug)}
					disabled={disabled}
				>
					Create
				</button>
			</div>
		</div>
	)
}
