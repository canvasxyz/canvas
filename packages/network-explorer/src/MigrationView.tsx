import { useState } from "react"
import { Button, Box, Heading, Text, TextArea } from "@radix-ui/themes"
import { Canvas, generateChangesets, Changeset } from "@canvas-js/core"
import { EditorState } from "@codemirror/state"
import { useContractData } from "./hooks/useContractData.js"
import { useApplicationData } from "./hooks/useApplicationData.js"
import { Editor } from "./components/Editor.js"

export const MigrationView = () => {
	const contractData = useContractData()
	const applicationData = useApplicationData()

	const [error, setError] = useState<string>()
	const [changesets, setChangesets] = useState<Changeset[]>()
	const [newContract, setNewContract] = useState<string>()
	const [waitingForCommit, setWaitingForCommit] = useState<boolean>()

	const [editorState, setEditorState] = useState<EditorState | null>(null)

	const updateChangesets = async () => {
		const value = editorState?.doc.toString()
		if (!value || !contractData) {
			setError("No contract content")
			return
		}

		setError(undefined)
		setNewContract(undefined)
		setChangesets(undefined)
		setWaitingForCommit(undefined)

		try {
			const { contract: newContract, originalContract } = await Canvas.buildContract(value, {
				wasmURL: "./esbuild.wasm",
			})
			console.log(newContract, originalContract)

			const app = await Canvas.initialize({ contract: contractData.contract, topic: "test.a" })
			const newApp = await Canvas.initialize({ contract: newContract, topic: "test.b" })
			setNewContract(newContract)
			setChangesets(generateChangesets(app.getSchema(), newApp.getSchema()))
		} catch (err: any) {
			if ("message" in err && typeof err.message === "string") {
				setError(err.message)
			} else {
				setError(err.toString())
			}
		}
	}

	const cancelMigrations = async () => {
		setChangesets(undefined)
		setNewContract(undefined)
	}

	const runMigrations = async () => {
		if (!changesets || !newContract) {
			setError("No migrations to run")
			return
		}

		const snapshot = await fetch("/api/migrate", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ contract: newContract, changesets }),
		}).then(async () => {
			setChangesets(undefined)
			setNewContract(undefined)
			setWaitingForCommit(true)

			// Refresh both data contexts
			await Promise.all([contractData?.refetch(), applicationData?.refetch()])

			setWaitingForCommit(false)
		})

		return snapshot
	}

	return (
		<Box px="7" py="6" flexGrow="1">
			<Heading size="3" mb="4">
				Edit Contract
			</Heading>
			{contractData === null ? (
				<>Loading...</>
			) : (
				<>
					<Box style={{ border: "1px solid var(--gray-6)", borderRadius: "2px", width: "100%" }}>
						<Editor initialValue={contractData.contract} onChange={setEditorState} />
					</Box>
					<Box mt="4">
						<Button size="2" variant="solid" onClick={updateChangesets}>
							Build
						</Button>
						{error && (
							<Box mt="2">
								<Text size="2" color="red">
									{error}
								</Text>
							</Box>
						)}
						{changesets && (
							<Box mt="2">
								<Text size="2" color="green">
									Success: Built contract ({editorState?.doc.length} chars)
									<br />
									<Box style={{ width: "100%" }}>
										<TextArea
											size="2"
											variant="classic"
											resize="none"
											style={{ padding: "4px 20px", fontFamily: "monospace", minHeight: "20vh" }}
										>
											{JSON.stringify(changesets, null, 2)}
										</TextArea>
									</Box>
								</Text>
							</Box>
						)}
					</Box>
					{changesets && newContract && (
						<Box mt="4">
							<Button size="2" variant="solid" onClick={runMigrations}>
								Commit Changes
							</Button>
							&nbsp;
							<Button size="2" variant="outline" onClick={cancelMigrations}>
								Cancel
							</Button>
						</Box>
					)}
					{waitingForCommit && (
						<Box mt="4">
							<Text size="2">Waiting for server...</Text>
						</Box>
					)}
				</>
			)}
		</Box>
	)
}
