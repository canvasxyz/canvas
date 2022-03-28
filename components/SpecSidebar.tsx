export function Sidebar({ app }) {
	return (
		<div className="">
			<div className="font-semibold mb-3">Spec</div>
			<div className="border rounded overflow-hidden">
				<a
					className={`text-sm px-3 py-1.5 flex gap-4 hover:bg-gray-100 ${
						app.version_number === null ? "!bg-blue-500 text-white" : ""
					}`}
					href="?"
				>
					<span className={`${app.version_number === null ? "font-bold" : ""}`}>Latest</span>
				</a>
				{app.versions.map(({ version_number }, index) => {
					return (
						<a
							key={version_number}
							className={`text-sm px-3 py-1.5 flex gap-4 hover:bg-gray-100 border-t ${
								app.version_number === version_number ? "!bg-blue-500 text-white" : ""
							}`}
							href={`?version=v${version_number}`}
						>
							<span className={`flex-1 ${app.version_number === version_number ? "font-bold" : ""}`}>
								v{version_number}
							</span>
						</a>
					)
				})}
			</div>
		</div>
	)
}
