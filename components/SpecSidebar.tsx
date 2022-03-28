interface SidebarProps {
	version_number: null | number
	app: {
		slug: string
		draft_spec: string
		versions: {
			multihash: string
			version_number: number
			spec: string
		}[]
	}
	edited: boolean
}

export function Sidebar({ version_number, app, edited }: SidebarProps) {
	return (
		<div className="">
			<div className="font-semibold mb-3">Spec</div>
			<div className="border rounded overflow-hidden">
				<a
					className={`text-sm px-3 py-1.5 flex gap-4 hover:bg-gray-100 ${
						version_number === null ? "!bg-blue-500 text-white" : ""
					}`}
					href="?"
				>
					<span className={`flex-1 ${version_number === null ? "font-semibold" : ""}`}>Latest</span>
					{edited && <span className="text-gray-400">Edited</span>}
				</a>
				{app.versions.map((version, index) => {
					return (
						<a
							key={version_number}
							className={`text-sm px-3 py-1.5 flex gap-4 hover:bg-gray-100 border-t ${
								version.version_number === version_number ? "!bg-blue-500 text-white" : ""
							}`}
							href={`?version=v${version_number}`}
						>
							<span className={`flex-1 ${version.version_number === version_number ? "font-semibold" : ""}`}>
								v{version_number}
							</span>
							<span className="text-gray-400">{version.multihash.slice(0, 6)}&hellip;</span>
						</a>
					)
				})}
			</div>
		</div>
	)
}
