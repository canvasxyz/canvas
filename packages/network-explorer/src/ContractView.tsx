import { useState, useEffect } from "react"
import { Button, Box, Heading, Text } from "@radix-ui/themes"
import { EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { useContractData } from "./hooks/useContractData.js"
import { Editor } from "./components/Editor.js"
import { useStagedMigrations } from "./hooks/useStagedMigrations.js"

// Define a localStorage key for unsaved changes
const UNSAVED_CHANGES_KEY = "contract-editor-unsaved-changes"

export const ContractView = () => {
	const contractData = useContractData()

	const {
		rebuildContract,
		contractChangesets,
		clearContractChangesets,
		newContract,
		hasRestoredContent,
		setHasRestoredContent,
	} = useStagedMigrations()

	const [error, setError] = useState<string>()

	const [editorState, setEditorState] = useState<EditorState | null>(null)
	const [editorView, setEditorView] = useState<EditorView | null>(null)

	const [editorInitialValue, setEditorInitialValue] = useState<string | null>(null)

	// Load saved content from localStorage when component mounts
	useEffect(() => {
		if (contractData) {
			const savedContent = localStorage.getItem(UNSAVED_CHANGES_KEY)

			if (savedContent && savedContent !== contractData.originalContract) {
				setEditorInitialValue(savedContent)
				setHasRestoredContent(true)
			} else {
				setEditorInitialValue(contractData.originalContract)
			}
		}
	}, [contractData])

	// Save content to localStorage when editorState changes
	useEffect(() => {
		if (editorState) {
			const currentContent = editorState.doc.toString()

			// Only save if the content is different from the original
			if (contractData && currentContent !== contractData.originalContract) {
				localStorage.setItem(UNSAVED_CHANGES_KEY, currentContent)
			}
		}
	}, [editorState, contractData])

	const updateChangesets = async (state?: EditorState) => {
		const value = (editorState ?? state)?.doc.toString()
		if (!value || !contractData) {
			setError("No contract content")
			return
		}

		setError(undefined)

		// delete existing databases
		const dbs = await window.indexedDB.databases()
		dbs.forEach((db) => {
			if (db?.name?.startsWith("canvas/v1/test.a.") || db?.name?.startsWith("canvas/v1/test.b.")) {
				window.indexedDB.deleteDatabase(db.name)
			}
		})

		try {
			await rebuildContract(value)
		} catch (err: any) {
			setError(err.message)
			return
		}
	}

	function revertToOriginal() {
		if (!contractData || !editorState || !editorView) {
			return
		}
		// Clear the editor
		const update = editorState.update({
			changes: { from: 0, to: editorState.doc.length, insert: contractData.originalContract },
		})
		editorView?.dispatch(update)

		// Clear other state
		setEditorInitialValue(contractData.originalContract)
		localStorage.removeItem(UNSAVED_CHANGES_KEY)
		setHasRestoredContent(false)
		clearContractChangesets()
		setError(undefined)
	}

	return (
		<Box px="7" py="6" flexGrow="1">
			<Heading size="3" mb="4">
				Contract Code
			</Heading>
			{contractData === null ? (
				<>Loading...</>
			) : (
				<>
					<Box style={{ border: "1px solid var(--gray-6)", borderRadius: "2px", width: "100%" }}>
						{editorInitialValue !== null && (
							<Editor
								initialValue={editorInitialValue}
								autofocus={true}
								onChange={(state, view) => {
									setEditorState(state)
									setEditorView(view)
								}}
								onLoad={(state, view) => {
									setEditorState(state)
									setEditorView(view)
								}}
								readOnly={contractData?.admin ? false : true}
								onBuild={(state, _view) => {
									updateChangesets(state)
								}}
							/>
						)}
					</Box>

					{error ? (
						<Box mt="2">
							<Text size="2" color="red">
								{error}
							</Text>
						</Box>
					) : contractChangesets && newContract ? (
						<Box mt="2">
							<Text size="2" color="green">
								Success: Built contract ({editorState?.doc.length} chars)
							</Text>
						</Box>
					) : hasRestoredContent ? (
						<Box mt="2">
							<Text size="2" color="blue">
								Restored unsaved changes from your previous session
							</Text>
						</Box>
					) : (
						<></>
					)}

					{contractData?.admin && (
						<>
							<Box mt="4">
								<Button
									size="2"
									variant="solid"
									onClick={(e) => {
										e.preventDefault()
										updateChangesets()
									}}
								>
									Build
								</Button>
								&nbsp;
								<Button
									size="2"
									variant="outline"
									color="gray"
									onClick={(e) => {
										e.preventDefault()
										revertToOriginal()
									}}
								>
									Revert to Original
								</Button>
							</Box>
						</>
					)}
				</>
			)}
			<br />
		</Box>
	)
}
