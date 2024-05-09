import { ReactNode } from "react"
import Navbar from "./Navbar"

function Container({ children }: { children: ReactNode }) {
	return (
		<>
			<div className="bg-[#3556A3] h-24 w-full top-14 -z-10 absolute"></div>
			<div className="max-w-4xl container mx-auto text-xs flex flex-col gap-5">
				<Navbar />
				{children}
			</div>
		</>
	)
}

export default Container
