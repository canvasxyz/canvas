declare module "use-hash-param" {
	export default function useHashParam(key: string, defaultValue: string): [string, (value: string) => void]
}
