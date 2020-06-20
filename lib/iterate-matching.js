'use strict'

const NONE = Symbol('no item kept')

const createIterateMatching = (compareFn, sortedItems) => {
	if (typeof sortedItems.next !== 'function') {
		if (typeof sortedItems[Symbol.asyncIterator] !== 'function') {
			throw new Error('sortedItems must be an async iterator or async iterable')
		}
		sortedItems = sortedItems[Symbol.asyncIterator]()
	}

	let over = false
	let keptItem = NONE
	const iterateMatching = async function* (model) {
		if (over) return;

		if (keptItem !== NONE) {
			const cmp = compareFn(model, keptItem)
			if (cmp === 0) {
				// model == keptItem, emit & discard keptItem
				yield keptItem
				keptItem = NONE
			} else if (cmp > 0) {
				// model > keptItem, discard keptItem
				keptItem = NONE
			} else {
				// model < keptItem, keep keptItem, abort fn
				return;
			}
		}

		while (true) {
			const {done, value: item} = await sortedItems.next()
			if (done) {
				over = true
				return;
			}

			const cmp = compareFn(model, item)
			if (cmp < 0) {
				// model < item, keep item for later
				keptItem = item
				return;
			}
			if (cmp === 0) {
				// model == item, emit item
				yield item
			}
			// model > item, discard item
		}
	}

	return iterateMatching
}

module.exports = createIterateMatching
