import { Link } from "react-router-dom"

function Navbar() {
	return (
		<div className="flex flex-row gap-10 pt-5">
			<Link to={"/"}>
				<div className="font-bold hover:underline">Canvas Explorer</div>
			</Link>
			<Link to={"/"}>
				<div className="hover:underline">Topics</div>
			</Link>
		</div>
	)
}

export default Navbar
