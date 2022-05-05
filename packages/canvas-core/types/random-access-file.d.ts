declare module "random-access-file" {
	import { RandomAccessStorage } from "random-access-storage"
	export type Options = {
		truncate: boolean
		size: number
		readable: boolean
		writable: boolean
		lock: (fd: number) => boolean
		sparse: (fd: number) => boolean
	}

	export default function randomAccessFile(dbname: string, options?: Partial<Options>): RandomAccessStorage
}
