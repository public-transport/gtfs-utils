'use strict'

const NONE = Symbol('no item')

async function* joinIteratively (compareFn, setA, setB, opt = {}) {
	const {
		filterA,
		filterB,
	} = {
		filterA: () => true,
		filterB: () => true,
		...opt,
	}

	const itA = setA[Symbol.asyncIterator]()
	const itB = setB[Symbol.asyncIterator]()

	let doneA = false, doneB = false
	let itemA, itemB
		;({done: doneA, value: itemA} = await itA.next())
		;({done: doneB, value: itemB} = await itB.next())

	while (!doneA && !doneB) {
		if (!filterA(itemA)) {
			// eslint-disable-next-line no-extra-semi
			;({done: doneA, value: itemA} = await itA.next())
			continue
		}
		if (!filterB(itemB)) {
			// eslint-disable-next-line no-extra-semi
			;({done: doneB, value: itemB} = await itB.next())
			continue
		}

		const cmp = compareFn(itemA, itemB)
		if (cmp < 0) { // itemA < itemB
			yield [itemA, NONE]
			;({done: doneA, value: itemA} = await itA.next())
		} else if (cmp === 0) { // itemA == itemB
			yield [itemA, itemB]
			;({done: doneA, value: itemA} = await itA.next())
			;({done: doneB, value: itemB} = await itB.next())
		} else { // itemA > itemB
			yield [NONE, itemB]
			;({done: doneB, value: itemB} = await itB.next())
		}
	}

	if (doneA) {
		while (!doneB) {
			if (filterB(itemB)) yield [NONE, itemB]
			;({done: doneB, value: itemB} = await itB.next())
		}
		return;
	}
	if (doneB) {
		while (!doneA) {
			if (filterA(itemA)) yield [itemA, NONE]
			;({done: doneA, value: itemA} = await itA.next())
		}
		return;
	}
}

joinIteratively.NONE = NONE
module.exports = joinIteratively
