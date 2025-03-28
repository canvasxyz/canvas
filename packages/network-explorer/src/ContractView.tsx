import { useState, MouseEvent, useEffect } from "react"
import { Button, Box, Heading, Text, TextArea } from "@radix-ui/themes"
import { Canvas, generateChangesets, Changeset } from "@canvas-js/core"
import { EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { useContractData } from "./hooks/useContractData.js"
import { useApplicationData } from "./hooks/useApplicationData.js"
import { Editor } from "./components/Editor.js"
import { SiweMessage } from "siwe"
import { utils } from "ethers"

// Define a localStorage key for unsaved changes
const UNSAVED_CHANGES_KEY = "contract-editor-unsaved-changes"

export const ContractView = () => {
	const contractData = useContractData()
	const applicationData = useApplicationData()

	const [error, setError] = useState<string>()
	const [changesets, setChangesets] = useState<Changeset[]>()
	const [newContract, setNewContract] = useState<string>()
	const [waitingForCommit, setWaitingForCommit] = useState<boolean>()
	const [commitCompleted, setCommitCompleted] = useState<boolean>()

	const [editorState, setEditorState] = useState<EditorState | null>(null)
	const [editorView, setEditorView] = useState<EditorView | null>(null)

	const [hasRestoredContent, setHasRestoredContent] = useState(false)
	const [editorInitialValue, setEditorInitialValue] = useState<string | null>(null)

	// Load saved content from localStorage when component mounts
	useEffect(() => {
		if (contractData) {
			const savedContent = localStorage.getItem(UNSAVED_CHANGES_KEY)

			if (savedContent) {
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

	const updateChangesets = async (e: MouseEvent) => {
		e.preventDefault()
		const value = editorState?.doc.toString()
		if (!value || !contractData) {
			setError("No contract content")
			return
		}

		setError(undefined)
		setNewContract(undefined)
		setChangesets(undefined)
		setWaitingForCommit(undefined)

		const { build } = await Canvas.buildContract(value, { wasmURL: "./esbuild.wasm" })

		const initErrorTimer = setTimeout(() => {
			setError(
				"Failed to initialize in-browser Canvas application. This is likely because " +
					"of an IndexedDB bug, try closing other windows and deleting the test.a and test.b databases.",
			)
		}, 500)

		try {
			const app = await Canvas.initialize({ contract: contractData.contract, topic: "test.a" })
			const newApp = await Canvas.initialize({ contract: build, topic: "test.b" })
			setNewContract(value)
			setChangesets(generateChangesets(app.getSchema(), newApp.getSchema()))
		} catch (err: any) {
			if ("message" in err && typeof err.message === "string") {
				setError(err.message)
			} else {
				setError(err.toString())
			}
		} finally {
			clearTimeout(initErrorTimer)
		}
	}

	const cancelMigrations = async (e: MouseEvent) => {
		e.preventDefault()
		setChangesets(undefined)
		setNewContract(undefined)
	}

	const runMigrations = async (e: MouseEvent) => {
		e.preventDefault()
		if (!changesets || !newContract) {
			setError("No migrations to run")
			return
		}

		try {
			// Check if ethereum provider is available
			// @ts-ignore
			if (!window.ethereum) {
				setError("Ethereum provider not found. Please install a wallet like MetaMask.")
				return
			}
			if (!contractData) {
				setError("Must wait for contractData to load")
				return
			}

			// Request account access
			// @ts-ignore
			const accounts = await window.ethereum.request({ method: "eth_requestAccounts" })
			const address = utils.getAddress(accounts[0])

			// Create SIWE message
			const domain = window.location.host
			const origin = window.location.origin
			const statement = "Sign this message to confirm the contract migration."

			const siweMessage = new SiweMessage({
				domain,
				address,
				statement,
				uri: origin,
				version: "1",
				chainId: 1, // Adjust based on your network
				nonce: contractData.nonce,
			})

			const message = siweMessage.prepareMessage()

			// Request signature from wallet
			// @ts-ignore
			const signature = await window.ethereum.request({
				method: "personal_sign",
				params: [message, address],
			})

			// Send to API with SIWE data
			const snapshot = await fetch("/api/migrate", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					newContract: newContract,
					changesets,
					siweMessage: message,
					address,
					signature,
				}),
			})
				.then(async (response) => {
					if (!response.ok) {
						throw new Error()
					}

					setChangesets(undefined)
					setNewContract(undefined)
					setWaitingForCommit(true)

					// Clear saved content from localStorage once committed
					localStorage.removeItem(UNSAVED_CHANGES_KEY)
					setHasRestoredContent(false)

					// Refresh both data contexts
					await Promise.all([contractData?.refetch(), applicationData?.refetch()])

					setWaitingForCommit(false)
					setCommitCompleted(true)
				})
				.catch((err) => {
					setError(err.message || "Server rejected code update")
				})

			return snapshot
		} catch (err: any) {
			console.log(err)
			setError(err.message || "Failed to sign message with wallet")
		}
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
								onChange={(state, view) => {
									setEditorState(state)
									setEditorView(view)
								}}
								onLoad={(state, view) => {
									setEditorState(state)
									setEditorView(view)
								}}
								readOnly={contractData?.admin ? false : true}
							/>
						)}
					</Box>

					{hasRestoredContent && (
						<Box mt="2">
							<Text size="2" color="blue">
								Restored unsaved changes from your previous session
							</Text>
						</Box>
					)}

					{contractData?.admin && (
						<>
							<Box mt="4">
								<Button size="2" variant="solid" onClick={updateChangesets}>
									Build
								</Button>
								&nbsp;
								<Button
									size="2"
									variant="outline"
									color="gray"
									onClick={(e) => {
										e.preventDefault()
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
										setChangesets(undefined)
										setNewContract(undefined)
										setError(undefined)
									}}
								>
									Revert to Original
								</Button>
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

							<Box mt="4">
								<Text size="2">Upgrade controller key: {contractData.admin}</Text>
							</Box>
							<Box mt="2">
								<Text size="2">Contract stored {contractData.inMemory ? "in-memory" : "on disk"}</Text>
							</Box>

							{changesets && newContract && (
								<Box mt="4">
									<Button size="2" variant="solid" onClick={runMigrations}>
										Sign and Commit Changes
									</Button>
									&nbsp;
									<Button size="2" variant="outline" onClick={cancelMigrations}>
										Cancel
									</Button>
								</Box>
							)}
							{error && (
								<Box mt="2">
									<Text size="2" color="red">
										{error}
									</Text>
								</Box>
							)}

							{waitingForCommit && (
								<Box mt="4">
									<Text size="2">Waiting for server...</Text>
								</Box>
							)}

							{commitCompleted && (
								<Box mt="4">
									<Text size="2">Changes committed!</Text>
								</Box>
							)}
						</>
					)}
					<br />
				</>
			)}
		</Box>
	)
}
