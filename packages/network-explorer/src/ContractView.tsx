import { Box, Heading, Text } from "@radix-ui/themes"
import { useContractData } from "./hooks/useContractData.js"

export const ContractView = () => {
	const contractData = useContractData()

	return (
		<Box px="7" py="6" flexGrow="1">
			<Heading size="3" mb="4">
				Contract Code
			</Heading>

			{contractData === null ? (
				<>Loading...</>
			) : (
				<Box style={{ border: '1px solid var(--gray-6)', borderRadius: '6px', width: '100%' }}>
					<Text size="2">
						<pre style={{ padding: '4px 20px' }}>{contractData.contract}</pre>
					</Text>
				</Box>
			)}
		</Box>
	)
}
