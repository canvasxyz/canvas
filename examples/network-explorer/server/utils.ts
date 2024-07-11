const peekable = async <T>(
	iterator: AsyncIterator<T>,
): Promise<{
	head: () => IteratorResult<T>
	consume: () => Promise<void>
}> => {
	let head = await iterator.next()

	return {
		head: () => head,
		consume: async () => {
			head = await iterator.next()
		},
	}
}

// TODO: unit tests for this
export const consumeOrderedIterators = async <T>(
	iterators: AsyncIterator<T>[],
	compare: (value1: T, value2: T) => any,
	numToConsume: number,
) => {
	// This function takes a list of async iterators, a comparison function and a number of items to consume (N)
	// It assumes that the async iterators are already ordered in the same way
	// It returns an array containing N of the "top" items consumed from all of the iterators

	const sources = []
	for (const iterator of iterators) {
		const p = await peekable(iterator)
		if (!p.head().done) sources.push(p)
	}

	const result: T[] = []
	while (result.length < numToConsume) {
		if (sources.length == 0) {
			break
		}

		let maxSource = sources[0]
		for (const source of sources) {
			// console.log(source.head())
			if (compare(source.head().value, maxSource.head().value)) {
				maxSource = source
			}
		}

		// add the highest value to the result
		result.push(maxSource.head().value)

		// consume the iterator that the highest value was taken from
		await maxSource.consume()

		// if maxSource is done, remove it from `sources`
		if (maxSource.head().done) {
			const indexToRemove = sources.findIndex((s) => s === maxSource)
			sources.splice(indexToRemove, 1)
		}
	}

	return result
}
