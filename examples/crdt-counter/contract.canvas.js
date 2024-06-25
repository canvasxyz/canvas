export const models = {
	counter: {
		id: "primary",
		value: "json",
		$merge: (counter1, counter2) => {
			const outputValue = {}
			for (const key of Object.keys({ ...counter1.value, ...counter2.value })) {
				outputValue[key] = Math.max(counter1.value[key] || 0, counter2.value[key] || 0)
			}
			return { id: counter1.id, value: outputValue }
		},
	},
}

export const actions = {
	async createCounter(db, {}, { id }) {
		await db.set("counter", { id, value: {} })
	},
	async incrementCounter(db, { id }, { did }) {
		const counter = await db.get("counter", id)
		counter.value[did] = (counter.value[did] || 0) + 1
		await db.set("counter", counter)
	},
}
