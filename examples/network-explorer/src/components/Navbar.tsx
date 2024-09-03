import { Link } from "react-router-dom"

function Navbar() {
	return (
		<div className="flex flex-row gap-10 pt-5 pb-5 border-b border-gray-200">
			<Link to={"/"}>
				<div className="font-bold">🌐 &nbsp;Canvas Explorer</div>
			</Link>
		</div>
	)
}

export default Navbar
