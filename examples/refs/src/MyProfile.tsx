import React from "react"
import { useLiveQuery } from "@canvas-js/hooks"
import type { ModelTypes } from "./refs.js"
import type { Canvas } from "@canvas-js/core"

interface MyProfileProps {
	app: Canvas | null
	did: string | null
}

export const MyProfile: React.FC<MyProfileProps> = ({ app, did }) => {
	const profile = app
		// @ts-expect-error: QueryParams type may not include 'id', but this is correct for primary key lookup
		? (useLiveQuery(app, "profile", did ? { id: did } : null) as ModelTypes["profile"][] | null)
		: null

	if (!did) {
		return (
			<div className="bg-gray-800 rounded-lg p-6 mb-4">
				<h2 className="text-xl font-semibold mb-3">My Profile</h2>
				<div className="text-gray-400">Loading DID...</div>
			</div>
		)
	}

	const currentProfile = profile && profile.length > 0 ? profile[0] : null

	return (
		<>
			<div className="bg-gray-800 rounded-lg p-6 mb-4">
				<h2 className="text-xl font-semibold mb-3">My Profile</h2>
				{currentProfile ? (
					<div className="flex items-center gap-4">
						<div className="w-20 h-20 rounded-full overflow-hidden bg-gray-600 flex items-center justify-center">
							{currentProfile.image ? (
								<img src={currentProfile.image} alt="Profile" className="w-full h-full object-cover" />
							) : (
								<span className="text-gray-400 text-4xl">👤</span>
							)}
						</div>
						<div>
							<div className="font-semibold text-lg">{currentProfile.userName || did}</div>
							<div className="text-gray-400 text-sm">
								{currentProfile.firstName || ""} {currentProfile.lastName || ""}
							</div>
							<div className="text-gray-400 text-sm">{currentProfile.location || currentProfile.geolocation || ""}</div>
							<div className="text-gray-500 text-xs mt-2">
								DID: <span className="break-all">{did}</span>
							</div>
						</div>
					</div>
				) : (
					<div className="flex flex-col items-center justify-center text-gray-400 h-32">
						<span className="text-4xl mb-2">👤</span>
						<span>No profile found for your DID.</span>
						<div className="text-gray-500 text-xs mt-2">
							<span className="break-all">{did}</span>
						</div>
					</div>
				)}
			</div>
			<CreateProfileForm app={app} did={did} initialProfile={currentProfile} />
		</>
	)
}

interface CreateProfileFormProps {
	app: Canvas | null
	did: string
	initialProfile: Partial<ModelTypes["profile"]> | null
}

const CreateProfileForm: React.FC<CreateProfileFormProps> = ({ app, did, initialProfile }) => {
	const [userName, setUserName] = React.useState(initialProfile?.userName || "")
	const [firstName, setFirstName] = React.useState(initialProfile?.firstName || "")
	const [lastName, setLastName] = React.useState(initialProfile?.lastName || "")
	const [geolocation, setGeolocation] = React.useState(initialProfile?.geolocation || "")
	const [location, setLocation] = React.useState(initialProfile?.location || "")
	const [image, setImage] = React.useState(initialProfile?.image || "")
	const [loading, setLoading] = React.useState(false)
	const [success, setSuccess] = React.useState(false)
	const [error, setError] = React.useState<string | null>(null)

	React.useEffect(() => {
		setUserName(initialProfile?.userName || "")
		setFirstName(initialProfile?.firstName || "")
		setLastName(initialProfile?.lastName || "")
		setGeolocation(initialProfile?.geolocation || "")
		setLocation(initialProfile?.location || "")
		setImage(initialProfile?.image || "")
	}, [initialProfile])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)
		setSuccess(false)
		setLoading(true)
		try {
			if (!app) throw new Error("App not ready")
			const profileData: ModelTypes["profile"] = {
				id: did,
				userName,
				firstName,
				lastName,
				geolocation,
				location,
				image,
				created: initialProfile?.created || new Date().toISOString(),
				updated: new Date().toISOString(),
			}
			await app.create("profile", profileData)
			setSuccess(true)
		} catch (err: any) {
			setError(err.message || "Failed to create/update profile")
		} finally {
			setLoading(false)
		}
	}

	return (
		<form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-6">
			<h2 className="text-lg font-semibold mb-3">{initialProfile ? "Update Profile" : "Create Profile"}</h2>
			<div className="flex flex-col gap-3">
				<input
					type="text"
					placeholder="Username"
					value={userName}
					onChange={(e) => setUserName(e.target.value)}
					className="px-2 py-1 rounded bg-gray-700 text-white"
					required
				/>
				<div className="flex flex-col sm:flex-row gap-2">
					<input
						type="text"
						placeholder="First Name"
						value={firstName}
						onChange={(e) => setFirstName(e.target.value)}
						className="px-2 py-1 rounded bg-gray-700 text-white min-w-0 w-full"
					/>
					<input
						type="text"
						placeholder="Last Name"
						value={lastName}
						onChange={(e) => setLastName(e.target.value)}
						className="px-2 py-1 rounded bg-gray-700 text-white min-w-0 w-full"
					/>
				</div>
				<input
					type="text"
					placeholder="Geolocation (optional)"
					value={geolocation}
					onChange={(e) => setGeolocation(e.target.value)}
					className="px-2 py-1 rounded bg-gray-700 text-white"
				/>
				<input
					type="text"
					placeholder="Location (optional)"
					value={location}
					onChange={(e) => setLocation(e.target.value)}
					className="px-2 py-1 rounded bg-gray-700 text-white"
				/>
				<input
					type="text"
					placeholder="Image URL (optional)"
					value={image}
					onChange={(e) => setImage(e.target.value)}
					className="px-2 py-1 rounded bg-gray-700 text-white"
				/>
				<button
					type="submit"
					disabled={loading}
					className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white disabled:opacity-50 mt-2"
				>
					{loading
						? initialProfile
							? "Updating..."
							: "Creating..."
						: initialProfile
							? "Update Profile"
							: "Create Profile"}
				</button>
				{error && <span className="text-red-400 text-sm">{error}</span>}
				{success && <span className="text-green-400 text-sm">Profile saved!</span>}
			</div>
		</form>
	)
}
