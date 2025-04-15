import { useState, MouseEvent, useEffect } from "react"
import { bytesToHex, randomBytes } from "@noble/hashes/utils"
import { Button, Box, Heading, Text, Checkbox } from "@radix-ui/themes"
import { Canvas, generateChangesets, Changeset as ChangesetMigrationRow, Changeset } from "@canvas-js/core"
import { EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { useContractData } from "./hooks/useContractData.js"
import { useApplicationData } from "./hooks/useApplicationData.js"
import { Editor } from "./components/Editor.js"
import { SiweMessage } from "siwe"
import { utils } from "ethers"

// Define a localStorage key for unsaved changes
const UNSAVED_CHANGES_KEY = "contract-editor-unsaved-changes"

const ChangesetMigrationRow = ({ change: c }: { change: Changeset }) => {
	// Determine the type of changeset and render appropriate content
	switch (c.change) {
		case "create_table":
			return <li>Create table: {c.table}</li>
		case "drop_table":
			return <li>Drop table: {c.table}</li>
		case "add_column":
			return (
				<li>
					Add column: {c.table}.{c.column} as {c.propertyType.endsWith("?") ? "nullable" : "non-nullable"}{" "}
					{c.propertyType.replace(/\?$/, "")}
				</li>
			)
		case "remove_column":
			return (
				<li>
					Drop column: {c.table}.{c.column}
				</li>
			)
		case "make_optional_column":
			return (
				<li>
					Make column nullable: {c.table}.{c.column}
				</li>
			)
		default:
			return <li>Unknown: {JSON.stringify(c)}</li>
	}
}

export const ContractView = () => {
	const contractData = useContractData()
	const applicationData = useApplicationData()

	const [error, setError] = useState<string>()
	const [changesets, setChangesets] = useState<ChangesetMigrationRow[]>()
	const [newContract, setNewContract] = useState<string>()
	const [migrationIncludesSnapshot, setMigrationIncludesSnapshot] = useState(false)
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

	const updateChangesets = async (e: MouseEvent, state?: EditorState) => {
		e.preventDefault()
		const value = (editorState ?? state)?.doc.toString()
		if (!value || !contractData) {
			setError("No contract content")
			return
		}

		setError(undefined)
		setNewContract(undefined)
		setChangesets(undefined)
		setWaitingForCommit(undefined)

		const dbs = await window.indexedDB.databases()
		dbs.forEach((db) => {
			if (db?.name?.startsWith("canvas/v1/test.a.") || db?.name?.startsWith("canvas/v1/test.b.")) {
				window.indexedDB.deleteDatabase(db.name)
			}
		})

		const { build } = await Canvas.buildContract(value, { wasmURL: "./esbuild.wasm" })

		const initErrorTimer = setTimeout(() => {
			setError(
				"Failed to initialize in-browser Canvas application. This is likely because " +
					"of a known IndexedDB issue. Try building again, or try closing other tabs/windows on this page.",
			)
		}, 500)

		try {
			const app = await Canvas.initialize({
				contract: contractData.contract,
				topic: "test.a." + bytesToHex(randomBytes(32)),
				reset: true,
			})
			const newApp = await Canvas.initialize({
				contract: build,
				topic: "test.b." + bytesToHex(randomBytes(32)),
				reset: true,
			})
			setNewContract(value)
			setChangesets(generateChangesets(app.getSchema(), newApp.getSchema()))
		} catch (err: any) {
			if (err.name === "RuntimeError" && err.message.startsWith("Aborted(TypeError: WebAssembly.instantiate()")) {
				setError(
					err.message + " This may be because of an network explorer build issue. Try rebuilding the network explorer.",
				)
			} else if ("message" in err && typeof err.message === "string") {
				setError(err.message)
			} else {
				setError(err.toString())
			}
			console.error(err)
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
			// @ts-ignore
			if (!window.ethereum) {
				setError("Ethereum provider not found. Please install a wallet like MetaMask.")
				return
			}
			if (!contractData) {
				setError("Must wait for contractData to load")
				return
			}
			setError(undefined)

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
					includeSnapshot: migrationIncludesSnapshot,
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

					// Wait till server is available again
					while (true) {
						await new Promise((resolve, reject) => setTimeout(resolve, 500))
						const available = await new Promise((resolve) =>
							fetch("/api/contract")
								.then(() => resolve(true))
								.catch(() => resolve(false)),
						)
						if (available) break
					}

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
									const syntheticEvent = {
										preventDefault: () => {},
									} as React.MouseEvent<HTMLButtonElement>
									updateChangesets(syntheticEvent, state)
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
					) : changesets && newContract ? (
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
							</Box>
						</>
					)}

					{contractData?.admin && (
						<>
							{changesets && newContract && (
								<Box mt="5">
									<Box
										mt="2"
										style={{
											width: "100%",
											border: "1px solid var(--gray-6)",
											borderRadius: "2px",
										}}
									>
										<Box
											px="4"
											py="3"
											style={{
												borderBottom: "1px solid var(--gray-6)",
											}}
										>
											<Text size="2">Run Migrations</Text>
										</Box>
										<Box px="4" pt="1" pb="4">
											<Text size="2">
												<ul>
													{changesets.map((c) => (
														<ChangesetMigrationRow change={c} />
													))}
												</ul>
											</Text>
											<Box mt="4" pt="1">
												<Button size="2" variant="solid" onClick={runMigrations}>
													Sign and Commit Changes
												</Button>
												&nbsp;
												<Button size="2" variant="outline" onClick={cancelMigrations}>
													Cancel
												</Button>
											</Box>
											<Box mt="4">
												<Checkbox
													checked={migrationIncludesSnapshot}
													onCheckedChange={(value) => {
														if (value === "indeterminate") return
														setMigrationIncludesSnapshot(value)
													}}
												/>
												<Text size="2" style={{ position: "relative", top: "-4px", left: "6px" }}>
													Retain snapshot
												</Text>
											</Box>
											<Box mt="3">
												<Text size="2">Upgrade controller key: {contractData.admin}</Text>
											</Box>
											<Box mt="1">
												<Text size="2">
													Contract stored{" "}
													{contractData.inMemory
														? "in-memory. Changes will be lost when the explorer server restarts."
														: "on disk. Changes will be persisted on the explorer server."}
												</Text>
											</Box>
										</Box>
									</Box>
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
				</>
			)}
			<br />
		</Box>
	)
}
