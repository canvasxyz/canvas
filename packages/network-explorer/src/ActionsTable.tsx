import useSWR from "swr"
import { fetchAndIpldParseJson, Result } from "./utils.js"
import { Action } from "@canvas-js/interfaces"
import { Column, Table } from "./Table.js"

const ACTION_COLUMNS: Column[] = [
	{
		name: "did",
		type: "string",
	},
	{
		name: "name",
		type: "string",
	},
	{
		name: "type",
		type: "string",
	},
	{
		name: "timestamp",
		type: "number",
	},
]

function flattenActions(data: Result<Action>[]) {
	return data.map((action) => ({
		did: action.message.payload.did,
		name: action.message.payload.name,
		type: action.message.payload.type,
		timestamp: action.message.payload.context.timestamp,
	}))
}

export const ActionsTable = () => {
	// TODO: filters, sorting, pagination
	const params = ""
	const { data } = useSWR(`/api/actions?${params.toString()}`, fetchAndIpldParseJson<Result<Action>[]>, {
		refreshInterval: 1000,
	})

	const rows = data ? flattenActions(data.content) : []

	return <Table rows={rows} columns={ACTION_COLUMNS} responseTime={data?.responseTime} />
}
