import { Link } from "react-router-dom"

function Navbar() {
	return (
		<div className="flex flex-row gap-10 pt-5">
			<div className="font-bold">Canvas Explorer</div>
			<Link to={"/"}>
				<div>Applications</div>
			</Link>
		</div>
	)
}

export default Navbar
