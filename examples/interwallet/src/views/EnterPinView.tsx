import React from "react"

export const EnterPinView = (props: { submitPin: (pin: string) => void }) => {
	const [pin, setPin] = React.useState("")

	return (
		<div className="flex flex-row items-center justify-center h-screen overflow-hidden bg-white">
			<div className="container max-w-lg m-auto p-4 bg-gray-50 flex flex-col gap-4">
				<div className="text-2xl font-bold">Enter PIN</div>
				<form
					className="flex flex-row gap-3 items-center"
					onSubmit={(e) => {
						e.preventDefault()
						props.submitPin(pin)
					}}
				>
					<input
						className="h-10 w-full border border-black bg-white focus:outline-none pl-2"
						placeholder="XXXX"
						value={pin}
						onChange={(e) => setPin(e.target.value)}
					></input>
					<button
						className="p-2 rounded-md bg-blue-500 hover:bg-blue-700 hover:cursor-pointer select-none text-white text-center"
						type="submit"
					>
						Submit
					</button>
				</form>
			</div>
		</div>
	)
}
