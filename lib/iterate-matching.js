'use strict'

const NONE = Symbol('no item kept')

const createIterateMatching = (compareFn, sortedItems, onSkipped = () => {}) => {
	if (!!sortedItems || typeof sortedItems.next !== 'function') {
		if (sortedItems && typeof sortedItems[Symbol.asyncIterator] !== 'function') {
			throw new Error('sortedItems must be an async iterator or async iterable')
		}
		sortedItems = sortedItems[Symbol.asyncIterator]()
	}

	// Because the async iteration protocol doesn't let us peek at the upcoming
	// item within sortedItems, we have to retrieve it store a reference to it
	// if is smaller than the item. This is why it's hard to follow the
	// implementation intuitively.
	let over = false
	let keptItem = NONE
	const iterateMatching = async function* (model) {
		if (over) return;

		if (keptItem !== NONE) {
			const cmp = compareFn(model, keptItem)
			if (cmp === 0) {
				// model == keptItem, emit keptItem
				yield keptItem
				keptItem = NONE
			} else if (cmp > 0) {
				// model > keptItem, skip keptItem
				onSkipped(keptItem)
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
			} else if (cmp === 0) {
				// model == item, emit item
				yield item
			} else {
				// model > item, skip item
				onSkipped(item)
			}
		}
	}

	iterateMatching.asyncIterator = sortedItems
	return iterateMatching
}

module.exports = createIterateMatching
