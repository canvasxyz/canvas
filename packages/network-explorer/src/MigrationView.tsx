import { useState, useRef } from "react"
import { Button, Box, Heading, Text, TextArea } from "@radix-ui/themes"
import { useContractData } from "./hooks/useContractData.js"
import { Canvas, type ModelSchema } from "@canvas-js/core"

export const MigrationView = () => {
	const contractData = useContractData()
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const [error, setError] = useState<string>()
	const [newSchema, setNewSchema] = useState<ModelSchema>()

	return (
		<Box px="7" py="6" flexGrow="1">
			<Heading size="3" mb="4">
				Edit Contract
			</Heading>
			{contractData === null ? (
				<>Loading...</>
			) : (
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
			)}
			<Box mt="4">
				<Button
					size="2"
					variant="solid"
					onClick={async () => {
						const value = textareaRef.current?.value
						if (!value) {
							setError("No contract content")
							return
						}

						setError(undefined)
						setNewSchema(undefined)

						try {
							const contract = await Canvas.buildContract(value, { wasmURL: "./esbuild.wasm" })
							const newApp = await Canvas.initialize({ contract, topic: "test" })
							const newSchema = newApp.getSchema()
							setNewSchema(newSchema)
						} catch (err: any) {
							if ("message" in err && typeof err.message === "string") {
								setError(err.message)
							} else {
								setError(err.toString())
							}
						}
					}}
				>
					Build
				</Button>
				{error && (
					<Box mt="2">
						<Text size="2" color="red">
							{error}
						</Text>
					</Box>
				)}
				{newSchema && (
					<Box mt="2">
						<Text size="2" color="green">
							Success: Built contract ({textareaRef.current?.value?.length} chars)
							<br />
							<pre>{JSON.stringify(newSchema)}</pre>
						</Text>
					</Box>
				)}
			</Box>
			<Heading size="3" mb="4" mt="5">
				Run Migration
			</Heading>
			TODO
		</Box>
	)
}
