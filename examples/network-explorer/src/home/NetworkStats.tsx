import { version } from "../../package.json"

export function NetworkStats() {
	return (
		<div className="flex flex-row bg-white rounded-lg drop-shadow p-4 px-5 gap-3">
			<div className="w-1/2">
				<div className="font-bold">Status</div>
				<div className="font-medium">Online, running v{version}</div>
			</div>
		</div>
	)
}
