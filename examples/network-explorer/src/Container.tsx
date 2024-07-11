import { ReactNode } from "react"
import Navbar from "./components/Navbar.js"

function Container({ children }: { children: ReactNode }) {
	return (
		<>
			<div className="bg-[#20232a] h-32 w-full top-16 -z-10 absolute"></div>
			<div className="max-w-4xl container mx-auto flex flex-col gap-5">
				<Navbar />
				{children}
			</div>
		</>
	)
}

export default Container
