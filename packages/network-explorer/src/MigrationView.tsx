import { useState, useRef } from "react"
import { Button, Box, Heading, Text, TextArea } from "@radix-ui/themes"
import { useContractData } from "./hooks/useContractData.js"
import { Canvas, generateChangesets, Changeset } from "@canvas-js/core"

export const MigrationView = () => {
	const contractData = useContractData()
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const [error, setError] = useState<string>()
	const [changesets, setChangesets] = useState<Changeset[]>()
	const [newContract, setNewContract] = useState<string>()

	const updateChangesets = async () => {
		const value = textareaRef.current?.value
		if (!value || !contractData) {
			setError("No contract content")
			return
		}

		setError(undefined)
		setNewContract(undefined)
		setChangesets(undefined)

		try {
			const newContract = await Canvas.buildContract(value, { wasmURL: "./esbuild.wasm" })

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

	const runMigrations = async () => {
		if (!changesets || !newContract) {
			setError("No migrations to run")
			return
		}

		const snapshot = await fetch("/api/snapshot", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ contract: newContract, changesets }),
		})

		return snapshot
	}

	const runFlatten = async () => {
		await fetch("/api/flatten", {
			method: "POST",
		})
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
					<Box style={{ width: "100%" }}>
						<TextArea
							ref={textareaRef}
							size="2"
							variant="classic"
							resize="none"
							style={{ padding: "4px 20px", fontFamily: "monospace", minHeight: "50vh" }}
						>
							{contractData.contract}
						</TextArea>
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
									Success: Built contract ({textareaRef.current?.value?.length} chars)
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
					<Heading size="3" mb="4" mt="5">
						Run Migration
					</Heading>
					<Box mt="4">
						<Button size="2" variant="solid" onClick={runMigrations}>
							Run
						</Button>
					</Box>
					<Box mt="4">
						<Button size="2" variant="solid" onClick={runFlatten}>
							Flatten
						</Button>
					</Box>
				</>
			)}
		</Box>
	)
}
