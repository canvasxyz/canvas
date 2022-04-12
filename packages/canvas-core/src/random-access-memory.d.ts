declare module "random-access-file" {
	import { RandomAccessStorage } from "random-access-storage"
	export default function randomAccessMemory(): RandomAccessStorage
}
