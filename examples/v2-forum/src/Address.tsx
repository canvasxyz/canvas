import { useEnsName } from "wagmi"

export function Address({ address }: { address: string }) {
	const { data, error, isLoading, refetch } = useEnsName({
		address: address as `0x{string}`,
		enabled: false,
	})

	return <span>{data ? data : address}</span>
}
