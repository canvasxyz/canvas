import { ReactNode } from "react"
import Navbar from "./components/Navbar.js"

function Container({ children }: { children: ReactNode }) {
	return (
		<>
			<div className="max-w-4xl container mx-auto flex flex-col gap-5">
				<Navbar />
				{children}
			</div>
		</>
	)
}

export default Container
