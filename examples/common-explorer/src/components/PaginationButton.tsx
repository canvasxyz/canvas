import { Button } from "@radix-ui/themes"

function PaginationButton({ text, onClick, enabled }: { text: string; enabled: boolean; onClick: () => void }) {
	return (
		<Button onClick={onClick} disabled={!enabled}>
			{text}
		</Button>
	)
}

export default PaginationButton
