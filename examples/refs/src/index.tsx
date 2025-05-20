import "../styles.css"

import React, { useEffect } from "react"
import ReactDOM from "react-dom/client"

import { SIWESigner } from "@canvas-js/signer-ethereum"
import { useSIWE } from "@canvas-js/hooks/components"
import { useCanvas, AuthProvider, useLiveQuery } from "@canvas-js/hooks"

import { AppContext } from "./AppContext.js"

import { ModelTypes, models } from "./refs.js"
import { MyProfile } from "./MyProfile.js"

// CreateRefForm component for creating a new ref
const CreateRefForm: React.FC<{ app: ReturnType<typeof useCanvas<typeof models>>["app"] }> = ({ app }) => {
	const [title, setTitle] = React.useState(() => "Example Ref")
	const [type, setType] = React.useState("place")
	const [location, setLocation] = React.useState("New York, NY")
	const [image, setImage] = React.useState<string | null>(null)
	const [url, setUrl] = React.useState<string | null>(null)
	const [meta, setMeta] = React.useState<string | null>(null)
	const [loading, setLoading] = React.useState(false)
	const [error, setError] = React.useState<string | null>(null)
	const [success, setSuccess] = React.useState(false)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)
		setSuccess(false)
		if (!app) {
			setError("App not ready")
			return
		}
		if (!title || !location) {
			setError("Title and location are required")
			return
		}
		setLoading(true)
		try {
			const item: Omit<ModelTypes["ref"], "id"> = {
				creator: await app.signers.getFirst().getDid(),
				type,
				title,
				image,
				location,
				url,
				meta,
				created: new Date().toISOString(),
				updated: null,
				deleted: null,
			}
			await app.create("ref", item)
			setSuccess(true)
			setTitle("")
			setType("place")
			setLocation("")
			setImage(null)
			setUrl(null)
			setMeta(null)
		} catch (err: any) {
			setError(err.message || "Failed to create ref")
		} finally {
			setLoading(false)
		}
	}

	return (
		<form onSubmit={handleSubmit} className="mb-4 space-y-4">
			<div className="flex flex-col space-y-2">
				<input
					type="text"
					placeholder="Title"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					className="px-2 py-1 rounded bg-gray-700 text-white w-full"
					required
					disabled={!app}
				/>
				<select
					value={type}
					onChange={(e) => setType(e.target.value)}
					className="px-2 py-1 rounded bg-gray-700 text-white w-full"
					disabled={!app}
				>
					<option value="place">Place</option>
					<option value="artwork">Artwork</option>
					<option value="other">Other</option>
				</select>
				<input
					type="text"
					placeholder="Location"
					value={location}
					onChange={(e) => setLocation(e.target.value)}
					className="px-2 py-1 rounded bg-gray-700 text-white w-full"
					required
					disabled={!app}
				/>
				<input
					type="text"
					placeholder="Image URL (optional)"
					value={image ?? ""}
					onChange={(e) => setImage(e.target.value || null)}
					className="px-2 py-1 rounded bg-gray-700 text-white w-full"
					disabled={!app}
				/>
				<input
					type="text"
					placeholder="URL (optional)"
					value={url ?? ""}
					onChange={(e) => setUrl(e.target.value || null)}
					className="px-2 py-1 rounded bg-gray-700 text-white w-full"
					disabled={!app}
				/>
				<input
					type="text"
					placeholder="Meta (optional)"
					value={meta ?? ""}
					onChange={(e) => setMeta(e.target.value || null)}
					className="px-2 py-1 rounded bg-gray-700 text-white w-full"
					disabled={!app}
				/>
			</div>
			<div className="flex items-center space-x-2">
				<button
					type="submit"
					disabled={loading || !app}
					className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md text-white disabled:opacity-50"
				>
					{loading ? "Creating..." : "Create ref"}
				</button>
				{error && <span className="text-red-400 text-sm">{error}</span>}
				{success && <span className="text-green-400 text-sm">Created!</span>}
			</div>
		</form>
	)
}

// RefsList component for displaying refs
const RefsList: React.FC<{ refs: ModelTypes["ref"][] }> = ({ refs }) => {
	if (refs.length === 0) {
		return <div className="text-gray-400 text-center py-4">No refs created yet</div>
	}

	return (
		<div className="space-y-4">
			{refs.map((ref) => (
				<div key={ref.id} className="bg-gray-700 rounded-lg p-4">
					<div className="flex gap-4">
						<div className="flex-1 min-w-0">
							<div className="flex items-center justify-between">
								<h3 className="text-lg font-semibold truncate">{ref.title}</h3>
								<span className="text-sm text-gray-400 ml-2 shrink-0">{ref.type}</span>
							</div>
							<p className="text-gray-300 mt-1">{ref.location}</p>
							{ref.url && (
								<a
									href={ref.url}
									target="_blank"
									rel="noopener noreferrer"
									className="text-blue-400 hover:text-blue-300 text-sm mt-2 block"
								>
									Visit Link
								</a>
							)}
							{ref.meta && <p className="text-gray-400 text-sm mt-1">{ref.meta}</p>}
							<div className="text-gray-400 text-xs mt-2">
								Created: {ref.created ? new Date(ref.created).toLocaleDateString() : "Unknown date"}
							</div>
						</div>
						<div className="w-24 h-24 shrink-0 rounded-md overflow-hidden bg-gray-600 relative">
							{ref.image ? (
								<img src={ref.image} alt={ref.title ?? undefined} className="w-full h-full object-cover" />
							) : (
								<div className="absolute inset-0 flex items-center justify-center">
									<span className="text-gray-400 text-3xl">?</span>
								</div>
							)}
						</div>
					</div>
				</div>
			))}
		</div>
	)
}

const wsURL =
	document.location.hostname === "localhost"
		? `ws://${document.location.hostname}:8080`
		: `wss://${document.location.hostname}`

const Container: React.FC<{}> = ({}) => {
	const { app, ws, error } = useCanvas<typeof models>(wsURL, {
		signers: [new SIWESigner({ burner: true })],
		topic: "refs-example.canvas.xyz",
		contract: { models },
		// reset: true,
	})

	const { ConnectSIWE } = useSIWE(app)

	const refs = useLiveQuery(app, "ref", {}) ?? []
	const [did, setDid] = React.useState<string | null>(null)

	useEffect(() => {
		;(async () => {
			if (!app) return

			const signer = app.signers.getFirst()
			console.log(app.signers.getAll(), signer.key, await signer.getDid())
			if (signer) {
				setDid(await signer.getDid())
			}
		})()
	}, [app?.signerKeys])

	return (
		<AppContext.Provider value={{ app: app ?? null }}>
			{app && ws ? (
				<main className="max-w-5xl mx-auto my-6">
					<div className="flex justify-end mb-6">
						<ConnectSIWE />
					</div>
					<div className="flex mb-5">
						<div className="flex-1">
							{error ? <span className="text-red-500 ml-1.5">{error.toString()}</span> : ""}
							{ws.error ? <span className="text-red-500 ml-1.5">Connection error</span> : ""}
						</div>
					</div>
					<div className="flex gap-8">
						{/* Left: Refs */}
						<div className="flex-1 min-w-0">
							{/* Create Ref Module */}
							<div className="bg-gray-800 rounded-lg p-6 mb-6">
								<h2 className="text-xl font-semibold mb-4 flex items-center">
									<span className="mr-2">✨</span>
									Create New Ref
								</h2>
								<CreateRefForm app={app} />
							</div>

							{/* Refs List Module */}
							<div className="bg-gray-800 rounded-lg p-6">
								<h2 className="text-xl font-semibold mb-4 flex items-center">
									<span className="mr-2">📍</span>
									All Refs
								</h2>
								<div>
									<RefsList refs={refs} />
								</div>
							</div>
						</div>
						{/* Right: Profile */}
						<div className="w-full max-w-sm">
							<MyProfile app={app} did={did} />
						</div>
					</div>
				</main>
			) : (
				<div className="text-center my-20 text-white">Connecting to {wsURL}...</div>
			)}
		</AppContext.Provider>
	)
}

const root = ReactDOM.createRoot(document.getElementById("root")!)

root.render(
	<React.StrictMode>
		<AuthProvider>
			<Container />
		</AuthProvider>
	</React.StrictMode>,
)
