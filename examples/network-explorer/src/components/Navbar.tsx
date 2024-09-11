import { Card } from "@radix-ui/themes"
import { Link } from "react-router-dom"

function Navbar() {
	return (
		<Card className="flex flex-col gap-5">
			<Link to={"/"}>
				<div className="font-bold">🌐 &nbsp;Explorer</div>
			</Link>
		</Card>
	)
}

export default Navbar
