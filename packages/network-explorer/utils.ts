// TODO: unit tests for this
export const consumeOrderedIterators = async <T>(
	iterators: AsyncIterator<T>[],
	compare: (value1: T, value2: T) => any,
	numToConsume: number,
) => {
	// This function takes a list of async iterators, a comparison function and a number of items to consume (N)
	// It assumes that the async iterators are already ordered in the same way
	// It returns an array containing N of the "top" items consumed from all of the iterators

	const heads: IteratorResult<T>[] = []
	for (const messageIterator of iterators) {
		const iterResult = await messageIterator.next()
		heads.push(iterResult)
	}

	const result: T[] = []
	while (result.length < numToConsume) {
		let maxI = 0
		for (let i = 0; i < heads.length; i++) {
			if (heads[i].done) {
				continue
			}
			if (compare(heads[i].value, heads[maxI].value)) {
				maxI = i
			}
		}

		// return early if we run out of items
		if (!heads[maxI].value) {
			break
		}

		// add the highest value to the result
		result.push(heads[maxI].value)

		// consume the iterator that the highest value was taken from
		heads[maxI] = await iterators[maxI].next()
	}

	return result
}
