import { TopicStats } from "./TopicStats.js"
import { useParams } from "react-router-dom"
import ActionsTable from "./ActionsTable.js"
import SessionsTable from "./SessionsTable.js"

function Topic() {
	const { topic } = useParams()

	if (!topic) {
		// TODO: 404 page
		return <div>Topic not found</div>
	}

	return (
		<>
			<div className="text-white pt-5 text-lg font-bold">Topic Information</div>
			<TopicStats topic={topic} />
			<ActionsTable topic={topic} />
			<SessionsTable topic={topic} />
		</>
	)
}

export default Topic
