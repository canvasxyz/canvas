declare module "random-access-idb" {
	import { RandomAccessStorage } from "random-access-storage"
	export type Options = { size: number }
	export type DB = (file: string, options?: Partial<Options>) => RandomAccessStorage
	export default function randomAccessIDB(dbname: string, options?: Partial<Options>): DB
}
