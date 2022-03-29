import { PrismaClient } from "@prisma/client"
import * as IpfsHttpClient from "ipfs-http-client"
import { Loader } from "utils/server/loader"

/**
 * This is a next.js hack to prevent new services from accumulating during hot reloading.
 * See https://github.com/vercel/next.js/issues/7811 for details.
 *
 * This does mean that code loaded here (ie Loader class methods) won't get hot-reloading treatment.
 */

declare global {
	var prisma: PrismaClient
	var ipfs: IpfsHttpClient.IPFSHTTPClient
	var loader: Loader
}

function getPrismaClient() {
	if (process.env.NODE_ENV === "production") {
		return new PrismaClient()
	} else if (global.prisma !== undefined) {
		return global.prisma
	} else {
		global.prisma = new PrismaClient()
		return global.prisma
	}
}

export const prisma = getPrismaClient()

function getIpfsClient() {
	if (process.env.NODE_ENV === "production") {
		return IpfsHttpClient.create()
	} else if (global.ipfs !== undefined) {
		return global.ipfs
	} else {
		global.ipfs = IpfsHttpClient.create()
		return global.ipfs
	}
}

export const ipfs = getIpfsClient()

function getLoader(): Loader {
	if (process.env.NODE_ENV === "production") {
		return new Loader()
	} else if (global.loader !== undefined) {
		return global.loader
	} else {
		global.loader = new Loader()
		return global.loader
	}
}

export const loader = getLoader()
