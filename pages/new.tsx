import { StatusCodes } from "http-status-codes"
import { useRouter } from "next/router"
import React, { useCallback, useState } from "react"

import { alphanumericWithDashes } from "utils/shared/regexps"

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

	const disabled = loading || !alphanumericWithDashes.test(slug)

	return (
		<div className="w-96">
			<h1 className="font-semibold mt-2 mb-4">New Project</h1>

			<div className="border rounded bg-white px-4 py-2 pb-5">
				<div className="my-2 flex gap-2">
					<label className="py-1.5 mr-2">Name</label>
					<input
						className="border w-full px-3 py-1 rounded outline-none focus:border-blue-500"
						type="text"
						placeholder="example-app"
						value={slug}
						onChange={({ target: { value } }) => setSlug(value)}
					/>
				</div>

				<button
					className={`block w-full mt-4 p-2 rounded bg-blue-500 hover:bg-blue-500 font-semibold text-sm text-center text-white cursor-pointer ${
						disabled ? "pointer-events-none opacity-50" : ""
					}`}
					onClick={() => handleSubmit(slug)}
					disabled={disabled}
				>
					Create
				</button>
			</div>
		</div>
	)
}
