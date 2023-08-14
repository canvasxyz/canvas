import os from "node:os"

export function getDomain(): string {
	return os.hostname()
}
